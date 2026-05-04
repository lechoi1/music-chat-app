import { createApp, defineAsyncComponent, ref, computed } from "vue";
import { createRouter, createWebHashHistory } from "vue-router";
import { GraffitiDecentralized } from "@graffiti-garden/implementation-decentralized";
import { GraffitiPlugin, useGraffiti, useGraffitiSession, useGraffitiDiscover } from "@graffiti-garden/wrapper-vue";
import { getLatestBy } from "./utils.js";

function loadComponent(name) {
  return () => import(`./${name}/main.js`).then((m) => m.default());
}

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", component: loadComponent("home") },
    { path: "/chat/:chatId", component: loadComponent("chat"), props: true },
    { path: "/profile/:actor", component: loadComponent("profile"), props: true },
    { path: "/search", component: loadComponent("search") },
    { path: "/explore", component: loadComponent("explore") },
  ],
});

function setup() {

  // Initialize Graffiti
  const graffiti = useGraffiti();
  const session = useGraffitiSession();

  // Discovering chats in the channel
  const { objects: allChats } = useGraffitiDiscover(
    ["designftw-26-music"],
    {
      properties: {
        value: {
          required: ["type", "channel", "title", "published"],
          properties: {
            type: { "const" : "Chat" },
            channel: { type : "string" },
            title: { type : "string" },
            published: { type : "number" },
          }
        }
      }
    },
    undefined,
    false
  )

  // Discovering user's chat memberships
  const { objects: memberships } = useGraffitiDiscover(
    () => session.value ? [session.value.actor] : [],
    {
      properties: {
        value: {
          required: ["type", "chatChannel", "status", "published"],
          properties: {
            type: { "const" : "Membership" },
            chatChannel: { type : "string" },
            status: { type : "string" },
            published: { type : "number" },
          }
        }
      }
    },
    undefined,
    true
  )

  const chats = computed(() => {
    const chatMap = getLatestBy(allChats.value, (c) => c.value.channel);
    const statusMap = getLatestBy(memberships.value, (m) => m.value.chatChannel);

    return Object.values(chatMap).filter(chat => 
      statusMap[chat.value.channel]?.value.status === "joined"
    );
  })

  // Creating a new chat
  const chatTitle = ref("");
  const isCreatingChat = ref(false);
  async function createChat(){
    if (!chatTitle.value.trim()) return;
    isCreatingChat.value = true;
    try {
      const channel = crypto.randomUUID();
      const published = Date.now();
      await graffiti.post(
        {
          value: {
            activity: "Create",
            type: "Chat",
            channel: channel,
            title: chatTitle.value,
            published: published,
          },
          channels: ["designftw-26-music"],
        },
        session.value,
      );
      await graffiti.post(
        {
          value: {
            type: "Membership",
            chatChannel: channel,
            status: "joined",
            published: published,
          },
          channels: [session.value.actor],
        },
        session.value,
      );
      chatTitle.value = "";
    } finally {
      isCreatingChat.value = false;
    }
  }

  return {
    chats,
    chatTitle,
    isCreatingChat,
    createChat,
  };
}

createApp({
  template: "#template",
  setup,
  components: {
    Home: defineAsyncComponent(loadComponent("home")),
  },
})
  .use(router)
  .use(GraffitiPlugin, {
    graffiti: new GraffitiDecentralized(),
  })
  .mount("#app");
