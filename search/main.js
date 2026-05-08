import { ref, computed, defineAsyncComponent, reactive } from "vue";
import { useGraffitiDiscover } from "@graffiti-garden/wrapper-vue";
import chatMessage from "../chat/chatMessage.js";
import { 
  normalizeGenre, 
  getLatestBy, 
  getUniqueGenres, 
  APP_CHANNEL 
} from "../utils.js";

export default async () => ({
  components: {
    chatMessage: defineAsyncComponent(chatMessage)
  },
  setup() {
    // Discover all chats to get the list of active channels
    const { objects: chatObjects } = useGraffitiDiscover(
      [APP_CHANNEL],
      {
        properties: {
          value: {
            required: ["type", "channel", "title", "published"],
            properties: {
              type: { "const" : "Chat" },
              channel: { type: "string" },
              title: { type: "string" },
              published: { type : "number" },
            },
          },
        },
      },
      undefined
    );

    const chatChannels = computed(() => {
      return Object.values(getLatestBy(chatObjects.value, (c) => c.value.channel))
        .map(chat => chat.value.channel);
    });

    // Discover all messages in those channels
    const { objects: allMessages } = useGraffitiDiscover(
      () => chatChannels.value,
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
      undefined
    );

    const draft = reactive({
      query: "",
      genre: ""
    });
    const activeSearch = reactive({
      query: "",
      genre: ""
    });

    // Extract all unique genres from all messages for the dropdown
    const availableGenres = computed(() => {
      return getUniqueGenres(allMessages.value);
    });

    const searchResults = computed(() => {
      const query = activeSearch.query.trim().toLowerCase();
      const genre = activeSearch.genre.toLowerCase();

      const latestMessages = Object.values(getLatestBy(allMessages.value, m => m.value.object || m.url));

      return latestMessages.filter(msg => {
        if (msg.value.activity === 'Delete') return false;
        const matchesQuery = !query || msg.value.content.toLowerCase().includes(query);
        const matchesGenre = !genre || (msg.value.genres && msg.value.genres.some(g => g.toLowerCase() === genre));
        return matchesQuery && matchesGenre;
      });
    });

    const performSearch = () => { 
      activeSearch.query = draft.query; 
      activeSearch.genre = draft.genre;
    };
    const getChatChannel = (msg) => msg.channels.find(c => chatChannels.value.includes(c));

    const isStale = computed(() => {
      return draft.query !== activeSearch.query || draft.genre !== activeSearch.genre;
    });

    return { draft, activeSearch, availableGenres, searchResults, performSearch, getChatChannel, isStale };
  },
  template: await fetch(new URL("./index.html", import.meta.url)).then((r) =>
    r.text(),
  ),
});
