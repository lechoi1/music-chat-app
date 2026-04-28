import { ref, computed, watch, defineAsyncComponent, nextTick, reactive } from "vue";
import { useGraffiti, useGraffitiSession, useGraffitiDiscover } from "@graffiti-garden/wrapper-vue";
import chatMessage from "./chatMessage.js";
import { useRoute } from "vue-router";
import { normalizeGenre, sortByPublished } from "../utils.js";

export default async () => ({
  props: ["chatId"],
  components: {
    chatMessage: defineAsyncComponent(chatMessage)
  },
  template: await fetch(new URL("./index.html", import.meta.url)).then((r) =>
    r.text(),
  ),
  setup(props) {
    const graffiti = useGraffiti();
    const route = useRoute();
    const session = useGraffitiSession();

    // Discovering messages specifically for this chatId
    const { objects: messageObjects, isFirstPoll: areMessageObjectsLoading } =
      useGraffitiDiscover(
        () => [props.chatId],
        {
          properties: {
            value: {
              required: ["content", "published"],
              properties: {
                content: { type: "string" },
                published: { type: "number" },
                genres: { type: "array", items: { type: "string" } },
              },
            },
          },
        },
        undefined,
        true
      );

    const sortedMessageObjects = computed(() => {
      return sortByPublished(messageObjects.value, false);
    });

    // Auto-scroll
    const bottomMarker = ref(null);

    watch([areMessageObjectsLoading, () => route.hash], ([loading, hash]) => {
      if (loading) return;

      nextTick(() => {
        if (hash) {
          const messageId = hash.substring(1);
          const targetElement = document.getElementById(messageId);
          if (targetElement) {
            targetElement.scrollIntoView({ block: "start" });
          }
        } else {
          bottomMarker.value?.scrollIntoView({ block: "end" });
        }
      });
    }, { flush: 'post', immediate: true });

    // Genre
    const predefinedGenres = ["Pop", "Rock", "Jazz"];
    const selectedPredefinedGenres = ref([]);
    const customGenres = reactive([{ id: 0, value: '', checked: true }]);
    let nextCustomGenreId = 1;

    const addCustomGenreField = () => {
      customGenres.push({ id: nextCustomGenreId++, value: '', checked: true });
    };

    const removeCustomGenreField = (id) => {
      const index = customGenres.findIndex(g => g.id === id);
      if (index !== -1) {
        customGenres.splice(index, 1);
      }
    };

    const resetGenreSelection = () => {
      selectedPredefinedGenres.value = [];
      customGenres.splice(0, customGenres.length, { id: 0, value: '', checked: true });
    };

    // Message sending
    const message = ref("");
    const isSending = ref(false);

    async function sendMessage() {
      if (!message.value.trim()) return;

      // Prepare genres: Combine, filter, and normalize
      const rawGenres = [
        ...selectedPredefinedGenres.value,
        ...customGenres.filter(g => g.checked && g.value.trim()).map(g => g.value.trim())
      ];
      const genres = rawGenres
        .filter(Boolean)
        .map(normalizeGenre);

      isSending.value = true;
      try {
        await graffiti.post(
          { 
            value: { 
              content: message.value, 
              published: Date.now(), 
              genres: [...new Set(genres)]
            }, 
            channels: [props.chatId] 
          }, 
          session.value,
        );
        message.value = "";
        resetGenreSelection(); // Reset genre selection after sending
      } finally {
        isSending.value = false;
      }
    }

    // Membership
    const { objects: myMemberships } = useGraffitiDiscover(
      () => session.value ? [session.value.actor] : [],
      {
        properties: {
          value: {
            required: ["type", "chatChannel", "status", "published"],
            properties: {
              type: { "const": "Membership" },
              chatChannel: { "const": props.chatId },
              status: { type: "string" },
              published: { type: "number" },
            },
          },
        },
      }
    );

    const isJoined = computed(() => {
      const sorted = sortByPublished(myMemberships.value);
      return sorted.length > 0 && sorted[0].value.status === 'joined';
    });

    const isTogglingJoin = ref(false);
    async function toggleJoin() {
      isTogglingJoin.value = true;
      try {
        await graffiti.post({
          value: {
            type: "Membership",
            chatChannel: props.chatId,
            status: isJoined.value ? 'left' : 'joined',
            published: Date.now()
          },
          channels: [session.value.actor]
        }, session.value);
      } finally {
        isTogglingJoin.value = false;
      }
    }

    return {
      predefinedGenres,
      selectedPredefinedGenres,
      customGenres,
      addCustomGenreField,
      removeCustomGenreField,
      message,
      areMessageObjectsLoading,
      sortedMessageObjects,
      isSending,
      sendMessage,
      bottomMarker,
      isJoined,
      toggleJoin,
      isTogglingJoin,
    };
  }
});
