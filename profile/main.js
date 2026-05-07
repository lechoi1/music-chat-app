import { ref, computed } from "vue";
import { useGraffiti, useGraffitiSession } from "@graffiti-garden/wrapper-vue";
import { useProfile, APP_CHANNEL } from "../utils.js";

export default async () => ({
  props: ["actor"],
  template: await fetch(new URL("./index.html", import.meta.url)).then((r) =>
    r.text(),
  ),
  setup(props) {
    const graffiti = useGraffiti();
    const session = useGraffitiSession();

    const { profileName } = useProfile(() => props.actor);

    const isMyProfile = computed(() => session.value?.actor === props.actor);

    const isSaving = ref(false);
    const newDisplayName = ref("");
    
    async function updateDisplayName() {
      if (!newDisplayName.value.trim()) return;
      isSaving.value = true;
      try {
        await graffiti.post({
          value: {
            type: "Profile",
            name: newDisplayName.value.trim(),
            published: Date.now()
          },
          channels: [APP_CHANNEL, session.value.actor]
        }, session.value);
        newDisplayName.value = "";
      } finally {
        isSaving.value = false;
      }
    }

    return {
      actor: props.actor,
      profileName,
      isMyProfile,
      newDisplayName,
      updateDisplayName,
      isSaving
    };
  }
});
