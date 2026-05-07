import { computed } from "vue";
import { useGraffitiDiscover } from "@graffiti-garden/wrapper-vue";

// The primary channel
export const APP_CHANNEL = "designftw-26-music2";

// Normalize genres to title case
export const normalizeGenre = (g) => 
  g.charAt(0).toUpperCase() + g.slice(1).toLowerCase();

// Sort Graffiti objects by their timestamp
export const sortByPublished = (objects, descending = true) => {
  return [...objects].sort((a, b) => 
    descending ? b.value.published - a.value.published : a.value.published - b.value.published
  );
};

// Helper to group objects by a key and return the most recent one for each group
export const getLatestBy = (objects, keySelector) => {
  const map = {};
  for (const obj of objects) {
    const key = keySelector(obj);
    if (!map[key] || obj.value.published > map[key].value.published) {
      map[key] = obj;
    }
  }
  return map;
};

// Composable to fetch and track the latest display name for a given actor
export function useProfile(actorGetter) {
  const { objects: profileObjects } = useGraffitiDiscover(
    () => {
      const actor = actorGetter();
      return actor ? [actor] : [];
    },
    {
      properties: {
        value: {
          required: ["type", "name", "published"],
          properties: {
            type: { "const": "Profile" },
            name: { type: "string" },
            published: { type: "number" },
          },
        },
      },
    },
    undefined,
    true
  );

  const profileName = computed(() => {
    const sorted = sortByPublished(profileObjects.value);
    return sorted[0]?.value.name;
  });

  return { profileName };
}

// Extract unique actor IDs from a variety of Graffiti sources (strings, objects, or arrays).
export function extractActors(...args) {
  const actors = new Set();
  const process = (item) => {
    if (!item) return;
    if (typeof item === 'string') {
      actors.add(item);
    } else if (Array.isArray(item)) {
      item.forEach(process);
    } else if (item.actor) {
      actors.add(item.actor);
    }
  };
  args.forEach(process);
  return [...actors];
}

// Maps channel IDs to the user's latest membership status from a list of membership objects
export function getMembershipStatusMap(membershipObjects) {
  const latest = getLatestBy(membershipObjects, (m) => m.value.chatChannel);
  return Object.fromEntries(
    Object.entries(latest).map(([channel, m]) => [channel, m.value.status])
  );
}

// Creates a map from actor ID to name from a list of profile objects
export function getActorToNameMap(profileObjects) {
  const latestProfiles = getLatestBy(profileObjects, (p) => p.actor);
  return Object.fromEntries(
    Object.entries(latestProfiles).map(([actor, p]) => [actor, p.value.name]),
  );
}

// Returns a profile name for an actor, falling back to a truncated actor ID or "Unknown"
export function getFriendlyName(actor, nameMap) {
  if (nameMap && nameMap[actor]) return nameMap[actor];
  if (!actor) return "Unknown";
  return actor.split(":").pop().substring(0, 8);
}


// Extracts unique, normalized, and alphabetically sorted genres from a list of messages
export const getUniqueGenres = (messages, extraGenres = []) => {
  const genres = new Set(extraGenres.map(normalizeGenre));
  messages.forEach(msg => {
    if (msg.value?.genres) {
      msg.value.genres.forEach(g => genres.add(normalizeGenre(g)));
    }
  });
  return Array.from(genres).sort();
};
