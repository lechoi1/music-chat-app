import { ref, computed, defineAsyncComponent, reactive } from "vue";
import { useGraffitiDiscover } from "@graffiti-garden/wrapper-vue";
import chatMessage from "../chat/chatMessage.js";
import { normalizeGenre } from "../utils.js";

export default async () => ({
  components: {
    chatMessage: defineAsyncComponent(chatMessage)
  },
  setup() {
    // Discover all chats to get the list of active channels
    const { objects: chatObjects } = useGraffitiDiscover(
      ["designftw-26-music"],
      {
        properties: {
          value: {
            required: ["activity", "type", "channel", "title", "published"],
            properties: {
              activity: { "const" : "Create" },
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

    const chatChannels = computed(() => 
      chatObjects.value.map(chat => chat.value.channel)
    );

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
      const allMessageGenres = allMessages.value.flatMap(msg => msg.value.genres || []);
      return Array.from(new Set(
        allMessageGenres.map(normalizeGenre)
      )).sort();
    });

    const searchResults = computed(() => {
      const query = activeSearch.query.trim().toLowerCase();
      const genre = activeSearch.genre.toLowerCase();

      return allMessages.value.filter(msg => {
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

    return { draft, activeSearch, availableGenres, searchResults, performSearch, getChatChannel };
  },
  template: await fetch(new URL("./index.html", import.meta.url)).then((r) =>
    r.text(),
  ),
});
