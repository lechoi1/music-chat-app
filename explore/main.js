import { useGraffitiDiscover, useGraffitiSession } from "@graffiti-garden/wrapper-vue";
import { useRouter } from "vue-router";
import { computed } from "vue";

export default async () => ({
  setup() {
    const router = useRouter();
    const session = useGraffitiSession();

    // Discover all chats within the application's specific channel
    const { objects: chats, isFirstPoll: isLoading } = useGraffitiDiscover(
      () => ["designftw-26-music"],
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
      },
      undefined,
      true
    );

    // Discovering user's chat memberships to check join status
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
    );

    const membershipStatusMap = computed(() => {
      const map = {};
      for (const m of memberships.value) {
        const channel = m.value.chatChannel;
        if (!map[channel] || m.value.published > map[channel].published) {
          map[channel] = m.value.status;
        }
      }
      return map;
    });

    function joinAndNavigate(chat) {
      router.push(`/chat/${chat.value.channel}`);
    }

    return {
      chats,
      isLoading,
      joinAndNavigate,
      isChatJoined: (channel) => membershipStatusMap.value[channel] === 'joined',
    };
  },
  template: await fetch(new URL("./index.html", import.meta.url)).then((r) =>
    r.text(),
  ),
});