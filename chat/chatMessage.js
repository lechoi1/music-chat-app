import { ref, computed } from "vue";
import { useGraffiti, useGraffitiSession } from "@graffiti-garden/wrapper-vue";
import { useProfile } from "../utils.js";

export default async () => ({
  props: ["msg", "allExistingGenres"],
  template: await fetch(new URL("./chatMessage.html", import.meta.url)).then((r) =>
    r.text(),
  ),
  setup(props) {
    const graffiti = useGraffiti();
    const session = useGraffitiSession();

    const isDeleting = ref(false);
    const isSaving = ref(false);
    const isEditing = ref(false);
    const isInputFocused = ref(false);

    const editedContent = ref("");
    const editedIsMusicMode = ref(false);
    const editedGenres = ref([]);
    
    const isMine = computed(() => 
      props.msg.actor === session.value?.actor
    );

    function startEditing() {
      editedContent.value = props.msg.value.content;
      editedIsMusicMode.value = !!(props.msg.value.genres && props.msg.value.genres.length > 0);
      editedGenres.value = [...(props.msg.value.genres || [])];
      isEditing.value = true;
    }

    async function saveEdit() {
      isSaving.value = true;
      try {
        const originalTimestamp = props.msg.value.created || props.msg.value.published;

        await graffiti.post({
          value: {
            ...props.msg.value,
            content: editedContent.value,
            genres: editedIsMusicMode.value ? editedGenres.value : [],
            activity: "Update",
            object: props.msg.value.object || props.msg.url,
            published: Date.now(),
            created: originalTimestamp
          },
          channels: props.msg.channels
        }, session.value);
        isEditing.value = false;
      } finally {
        isSaving.value = false;
      }
    }

    const { profileName } = useProfile(() => props.msg.actor);

    const searchQuery = computed(() => {
      const content = props.msg.value.content || "";
      const match = content.match(/"([^"]+)"/);
      return match ? match[1] : content;
    });

    async function deleteMessage() {
      isDeleting.value = true;
      try {
        await graffiti.delete(props.msg, session.value);
      } finally {
        isDeleting.value = false;
      }
    }

    return { 
      isDeleting, 
      deleteMessage, 
      isMine, 
      profileName, 
      actor: props.msg.actor,
      isEditing,
      isSaving,
      editedContent,
      editedIsMusicMode,
      editedGenres,
      startEditing,
      saveEdit,
      searchQuery,
      isInputFocused
    };
  }
});