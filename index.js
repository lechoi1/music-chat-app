import { createApp, ref, computed, watch } from "vue";
import { GraffitiDecentralized } from "@graffiti-garden/implementation-decentralized";
import {
  GraffitiPlugin,
  useGraffiti,
  useGraffitiSession,
  useGraffitiDiscover,
} from "@graffiti-garden/wrapper-vue";

function setup() {

  // Initialize Graffiti
  const graffiti = useGraffiti();
  const session = useGraffitiSession();

  // Make the channel as signal so that it can reactively change
  const channel = ref("designftw-26-music");

  // Discovering chats in the channel
  const { objects: chats } = useGraffitiDiscover(
    ["designftw-26-music"],
    {
      properties: {
        value: {
          required: ["activity", "type", "channel", "title", "published"],
          properties: {
            activity: { "const" : "Create" },
            type: { "const" : "Chat" },
            channel: { type : "string" },
            title: { type : "string" },
            published: { type : "number" },
          }
        }
      }
    }
  )

  // Creating a new chat
  const chatTitle = ref("");
  const isCreatingChat = ref(false);
  async function createChat(){
    isCreatingChat.value = true;
    try {
      await graffiti.post(
        {
          value: {
            activity: "Create",
            type: "Chat",
            channel: crypto.randomUUID(),
            title: chatTitle.value,
            published: Date.now(),
          },
          channels: ["designftw-26-music"],
        },
        session.value,
      );
      chatTitle.value = "";
    } finally {
      isCreatingChat.value = false;
    }
  }

  // Discovering messages in a chat
  const { objects: messageObjects, isFirstPoll: areMessageObjectsLoading } =
    useGraffitiDiscover(() =>
      [channel.value],
      {
        properties: {
          value: {
            required: ["content", "published"],
            properties: {
              content: { type: "string" },
              published: { type: "number" },
            },
          },
        },
      },
      undefined, // don't look for private messages
      true,      // automatically retrieve new messages
    );

  // Sort messages oldest to newest
  const sortedMessageObjects = computed(() => {
    return messageObjects.value.toSorted((a, b) => {
      return a.value.published - b.value.published;
    });
  });

  // Auto-scroll to the last message
  const bottomMarker = ref(null);
  function scrollBottomMarkerIntoView() {
    const anchor = bottomMarker.value;
    if (anchor) {
      anchor.scrollIntoView({ block: "end", behavior: "auto" });
    }
  }

  watch(
    bottomMarker,
    (el) => {
      if (!el) return;
      scrollBottomMarkerIntoView();
    },
  );

  // Sending a message in a chat
  const message = ref("");
  const isSending = ref(false);
  async function sendMessage() {
    isSending.value = true;
    try {
      await graffiti.post(
        {
          value: {
            content: message.value,
            published: Date.now(),
          },
          channels: [channel.value],
        },
        session.value,
      );
      message.value = "";
    } finally {
      isSending.value = false;
    }
  }

  // Deleting a message from a chat
  const isDeleting = ref(new Set());
  async function deleteMessage(message) {
    isDeleting.value.add(message.url);
    try {
      await graffiti.delete(message, session.value);
    } finally {
      isDeleting.value.delete(message.url);
    }
  }

  return {
    // Chats
    chats,
    chatTitle,
    isCreatingChat,
    createChat,

    // Messages
    message,
    areMessageObjectsLoading,
    sortedMessageObjects,
    isSending,
    sendMessage,
    isDeleting,
    deleteMessage,
    channel,
    bottomMarker,
  };
}

const App = { template: "#template", setup };

createApp(App)
  .use(GraffitiPlugin, {
    graffiti: new GraffitiDecentralized(),
  })
  .mount("#app");
