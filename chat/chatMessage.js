import { ref, computed } from "vue";
import { useGraffiti, useGraffitiSession } from "@graffiti-garden/wrapper-vue";
import { useProfile } from "../utils.js";

const getEmbedHtml = (url) => {
  if (!url) return null;

  // Spotify
  const spotifyMatch = url.match(/https:\/\/open\.spotify\.com\/(track|album|playlist|episode|show)\/([a-zA-Z0-9]+)/);
  if (spotifyMatch) {
    const [, type, id] = spotifyMatch;
    return `<iframe class="message-embed-iframe" src="https://open.spotify.com/embed/${type}/${id}?utm_source=generator" 
      width="100%" height="352" allowfullscreen="" 
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>`;
  }

  return null;
};

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
    const isUrlInputFocused = ref(false);

    const editedContent = ref("");
    const editedMusicUrl = ref("");
    const editedIsMusicMode = ref(false);
    const editedGenres = ref([]);
    
    const isMine = computed(() => 
      props.msg.actor === session.value?.actor
    );

    function startEditing() {
      editedContent.value = props.msg.value.content;
      editedMusicUrl.value = props.msg.value.musicUrl || "";
      editedIsMusicMode.value = !!(props.msg.value.genres?.length || props.msg.value.musicUrl);
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
            musicUrl: editedIsMusicMode.value ? (editedMusicUrl.value.trim() || undefined) : undefined,
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

    const embeddedContent = computed(() => getEmbedHtml(props.msg.value.musicUrl));


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
      editedMusicUrl,
      editedIsMusicMode,
      editedGenres,
      startEditing,
      saveEdit,
      isUrlInputFocused,
      embeddedContent,
      searchQuery,
      isInputFocused
    };
  }
});