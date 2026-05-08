import { ref, computed, watch, defineAsyncComponent, nextTick, reactive } from "vue";
import { useGraffiti, useGraffitiSession, useGraffitiDiscover } from "@graffiti-garden/wrapper-vue";
import chatMessage from "./chatMessage.js";
import { useRoute } from "vue-router";
import { 
  normalizeGenre, 
  sortByPublished, 
  getLatestBy, 
  extractActors,
  getMembershipStatusMap,
  getUniqueGenres,
  APP_CHANNEL
} from "../utils.js";

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
                activity: { type: "string" },
                created: { type: "number" },
                object: { type: "string" },
              },
            },
          },
        },
        undefined,
        true
      );

    const sortedMessageObjects = computed(() => {
      const latest = getLatestBy(messageObjects.value, m => m.value.object || m.url);
      return sortByPublished(Object.values(latest), false);
    });

    // Auto-scroll
    const bottomMarker = ref(null);

    watch([areMessageObjectsLoading, () => route.hash], ([loading, hash]) => {
      if (loading) return;

      if (hash) {
        const messageId = hash.substring(1);
        const targetElement = document.getElementById(messageId);
        if (targetElement) {
          targetElement.scrollIntoView({ block: "start" });
        }
      } else {
        bottomMarker.value?.scrollIntoView({ block: "end" });
      }
    }, { flush: 'post', immediate: true });

    // Mode toggle
    const isMusicMode = ref(false);

    // Genre
    const predefinedGenres = ["Pop", "Rock", "Jazz", "R&B", "Hip-hop"];
    const selectedFromModal = ref([]);
    const isGenreModalOpen = ref(false);
    const customGenres = reactive([{ id: 0, value: '', checked: false }]);
    let nextCustomGenreId = 1;

    // Discover all chats to get the list of active channels (for global genre aggregation)
    const { objects: chatMetadataObjects } = useGraffitiDiscover(
      [APP_CHANNEL],
      () => ({
        properties: {
          value: {
            required: ["type", "channel", "title", "published"],
            properties: {
              type: { "const": "Chat" },
              channel: { type: "string" },
              title: { type: "string" },
              published: { type: "number" },
            },
          },
        },
      }),
      undefined,
      true
    );

    const latestChatMetadata = computed(() => {
      return getLatestBy(chatMetadataObjects.value, (o) => o.value.channel)[props.chatId];
    });

    const allAppChannels = computed(() => {
      return [...new Set(chatMetadataObjects.value.map(c => c.value.channel))];
    });

    // Discover messages across all channels to aggregate community-wide genres (same as Search page)
    const { objects: allAppMessages } = useGraffitiDiscover(
      allAppChannels,
      {
        properties: {
          value: {
            required: ["published"],
            properties: {
              genres: { type: "array", items: { type: "string" } },
              published: { type: "number" },
              activity: { type: "string" },
              created: { type: "number" },
              object: { type: "string" },
            },
          },
        },
      },
      undefined,
      true
    );

    // Discover user's own messages to find the last custom genre
    const { objects: myMessages } = useGraffitiDiscover(
      () => session.value ? [session.value.actor] : [],
      {
        properties: {
          value: {
            required: ["content", "published"],
            properties: {
              content: { type: "string" },
              published: { type: "number" },
              genres: { type: "array", items: { type: "string" } },
              activity: { type: "string" },
              created: { type: "number" },
              object: { type: "string" },
            },
          },
        },
      },
      undefined,
      false
    );

    const lastCustomGenre = computed(() => {
      const latest = getLatestBy(myMessages.value, m => m.value.object || m.url);
      const sorted = sortByPublished(Object.values(latest), true);
      for (const msg of sorted) {
        if (msg.value.genres && msg.value.genres.length > 0) {
          const custom = msg.value.genres.find(g => 
            !predefinedGenres.includes(normalizeGenre(g))
          );
          if (custom) return normalizeGenre(custom);
        }
      }
      return null;
    });

    const selectedCommunityGenres = computed(() => {
      return selectedFromModal.value.filter(g => 
        !predefinedGenres.includes(g) && g !== lastCustomGenre.value
      );
    });

    const allExistingGenres = computed(() => {
      const latest = getLatestBy(allAppMessages.value, m => m.value.object || m.url);
      return getUniqueGenres(Object.values(latest), predefinedGenres);
    });

    const addCustomGenreField = () => {
      customGenres.push({ id: nextCustomGenreId++, value: '', checked: false });
    };

    const removeCustomGenreField = (id) => {
      const index = customGenres.findIndex(g => g.id === id);
      if (index !== -1) {
        customGenres.splice(index, 1);
      }
    };

    const resetGenreSelection = () => {
      selectedFromModal.value = [];
      customGenres.splice(0, customGenres.length, { id: 0, value: '', checked: false });
    };

    // Message sending
    const message = ref("");
    const isSending = ref(false);

    async function sendMessage() {
      if (!message.value.trim() || !isJoined.value) return;

      // Prepare genres: Combine, filter, and normalize
      const rawGenres = [
        ...selectedFromModal.value,
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
            channels: [APP_CHANNEL, props.chatId, session.value.actor] 
          }, 
          session.value,
        );
        message.value = "";
        resetGenreSelection(); // Reset genre selection after sending
      } finally {
        isSending.value = false;
      }
    }

    const chatName = computed(() => {
      return latestChatMetadata.value?.value.title;
    });

    // Sync the browser tab title with the chat name
    watch(chatName, (newName) => {
      if (newName) {
        document.title = `${newName} | Music Chat`;
      }
    }, { immediate: true });

    async function editChatName() {
      const newName = prompt("Enter new chat name:", chatName.value);
      const targetUrl = latestChatMetadata.value?.url;
      
      if (!newName || !newName.trim() || newName.trim() === chatName.value || !targetUrl) return;

      await graffiti.post({
        value: {
          activity: "Update",
          object: targetUrl,
          type: "Chat",
          channel: props.chatId,
          title: newName.trim(),
          published: Date.now()
        },
        channels: [APP_CHANNEL, session.value.actor]
      }, session.value);
    }

    // Membership
    const { objects: myMemberships } = useGraffitiDiscover(
      () => session.value ? [session.value.actor] : [],
      () => ({
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
      }),
      undefined,
      true
    );

    // Aggregate all unique actors to warm the profile cache
    const allActors = computed(() => {
      return extractActors(
        session.value?.actor,
        latestChatMetadata.value,
        messageObjects.value
      );
    });

    // Bulk discover profiles so the child components find them in the cache immediately
    useGraffitiDiscover(
      allActors,
      {
        properties: {
          value: {
            required: ["type", "name", "published"],
            properties: {
              type: { const: "Profile" },
              name: { type: "string" },
              published: { type: "number" },
            },
          },
        },
      },
      undefined,
      true
    );

    const isJoined = computed(() => {
      const statusMap = getMembershipStatusMap(myMemberships.value);
      return statusMap[props.chatId] === 'joined';
    });

    const isTogglingJoin = ref(false);
    async function toggleJoin() {
      if (!session.value) {
        alert("Please log in to join the chat.");
        return;
      }

      isTogglingJoin.value = true;
      try {
        await graffiti.post({
          value: {
            type: "Membership",
            chatChannel: props.chatId,
            status: isJoined.value ? 'left' : 'joined',
            published: Date.now()
          },
          channels: [APP_CHANNEL, props.chatId, session.value.actor]
        }, session.value);
      } finally {
        isTogglingJoin.value = false;
      }
    }

    return {
      isMusicMode,
      predefinedGenres,
      lastCustomGenre,
      selectedFromModal,
      selectedCommunityGenres,
      isGenreModalOpen,
      allExistingGenres,
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
      chatName,
      editChatName,
    };
  }
});
