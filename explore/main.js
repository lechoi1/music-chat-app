import { useGraffitiDiscover, useGraffitiSession } from "@graffiti-garden/wrapper-vue";
import { useRouter } from "vue-router";
import { computed } from "vue";
import { 
  getLatestBy, 
  sortByPublished, 
  extractActors, 
  getActorToNameMap, 
  getFriendlyName,
  getMembershipStatusMap,
  APP_CHANNEL
} from "../utils.js";

export default async () => ({
  setup() {
    const router = useRouter();
    const session = useGraffitiSession();

    // Discover all chats within the application's specific channel
    const { objects: rawChats, isFirstPoll: fetching } = useGraffitiDiscover(
      () => [APP_CHANNEL],
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
    );

    // Extract the list of active chat channels
    const chatChannels = computed(() => 
      [...new Set(rawChats.value.map((c) => c.value.channel))]
    );

    // Discover messages for each chat to show previews
    const { objects: allMessages } = useGraffitiDiscover(
      chatChannels,
      {
        properties: {
          value: {
            required: ["published"],
            properties: {
              content: { type: "string" }, // Content is optional to catch all historical objects
              published: { type: "number" },
            },
          },
        },
      },
      undefined,
      true
    );

    // Extract actors who are active (creators and message senders)
    const knownActors = computed(() => {
      return extractActors(session.value?.actor, rawChats.value, allMessages.value);
    });

    // Discover all memberships for the chats to count members
    const { objects: allMemberships } = useGraffitiDiscover(
      () => [...new Set([...chatChannels.value, ...knownActors.value])],
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
      true // Enable autopoll to ensure counts update as members join/leave
    );

    // Aggregate every unique actor encountered (active ones + those with membership records)
    const allActors = computed(() => {
      return extractActors(knownActors.value, allMemberships.value);
    });

    // Map channels to the list of unique joined actors
    const chatMembers = computed(() => {
      const statusMap = {}; // channel -> actor -> status

      // Seed with creators (implicitly joined)
      rawChats.value.forEach(c => {
        const ch = c.value.channel;
        if (ch && c.actor) {
          statusMap[ch] = statusMap[ch] || {};
          statusMap[ch][c.actor] = 'joined';
        }
      });

      // Seed with message senders and any other actors found in chat channels
      allMessages.value.forEach(m => {
        m.channels.forEach(ch => {
          if (chatChannels.value.includes(ch)) {
            statusMap[ch] = statusMap[ch] || {};
            // These users are in 'limbo' (sent message but haven't joined).
            // We treat them as 'joined' by default so they aren't left out.
            statusMap[ch][m.actor] = statusMap[ch][m.actor] || 'joined';
          }
        });
      });

      // Overlay explicit membership records (the "latest" status is the truth)
      const latest = Object.values(getLatestBy(allMemberships.value, m => `${m.actor}-${m.value.chatChannel}`));
      for (const m of latest) {
        const ch = m.value.chatChannel;
        statusMap[ch] = statusMap[ch] || {};
        statusMap[ch][m.actor] = m.value.status;
      }

      // Transform into the final map of actors with 'joined' status
      const result = {};
      for (const [ch, actors] of Object.entries(statusMap)) {
        result[ch] = Object.entries(actors)
          .filter(([_, status]) => status === 'joined')
          .map(([actor, _]) => actor);
      }
      return result;
    });

    // Discover profiles for everyone we've encountered
    const { objects: profileObjects } = useGraffitiDiscover(
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

    // Create a mapping from actor ID to their most recent profile name
    const actorToName = computed(() => {
      return getActorToNameMap(profileObjects.value);
    });

    // Combine chats with their latest messages for the UI
    const chats = computed(() => {
      const chatMap = getLatestBy(rawChats.value, (c) => c.value.channel);
      const sortedMessages = sortByPublished(allMessages.value, true);
      
      // Group messages by channel
      const messagesByChannel = {};
      for (const m of sortedMessages) {
        for (const ch of m.channels) {
          if (!chatChannels.value.includes(ch)) continue;
          
          messagesByChannel[ch] = messagesByChannel[ch] || [];
          // Limit previews to the most recent message
          if (messagesByChannel[ch].length < 1) {
            const senderName = getFriendlyName(m.actor, actorToName.value);
            messagesByChannel[ch].push({ text: m.value.content, sender: senderName });
          }
        }
      }

      return Object.values(chatMap).map((chat) => {
        const chatChannel = chat.value.channel;
        return {
          ...chat,
          value: {
            ...chat.value,
            messages: messagesByChannel[chatChannel] || [],
            members: chatMembers.value[chatChannel] || [],
          },
        };
      });
    });

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
      false
    );

    const membershipStatusMap = computed(() => {
      return getMembershipStatusMap(memberships.value);
    });

    function joinAndNavigate(chat) {
      router.push(`/chat/${chat.value.channel}`);
    }

    return {
      chats,
      isLoading: fetching,
      joinAndNavigate,
      isChatJoined: (channel) => membershipStatusMap.value[channel] === 'joined',
    };
  },
  template: await fetch(new URL("./index.html", import.meta.url)).then((r) =>
    r.text(),
  ),
});