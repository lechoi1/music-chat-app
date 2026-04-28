import { computed } from "vue";
import { useGraffitiDiscover } from "@graffiti-garden/wrapper-vue";

// Normalize genres to title case
export const normalizeGenre = (g) => 
  g.charAt(0).toUpperCase() + g.slice(1).toLowerCase();

// Sort Graffiti objects by their timestamp
export const sortByPublished = (objects, descending = true) => {
  return objects.toSorted((a, b) => 
    descending ? b.value.published - a.value.published : a.value.published - b.value.published
  );
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