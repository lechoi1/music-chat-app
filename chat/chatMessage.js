import { ref, computed } from "vue";
import { useGraffiti, useGraffitiSession } from "@graffiti-garden/wrapper-vue";
import { useProfile } from "../utils.js";

export default async () => ({
  props: ["msg"],
  template: await fetch(new URL("./chatMessage.html", import.meta.url)).then((r) =>
    r.text(),
  ),
  setup(props) {
    const graffiti = useGraffiti();
    const session = useGraffitiSession();
    const isDeleting = ref(false);
    
    const isMine = computed(() => 
      props.msg.actor === session.value?.actor
    );

    const { profileName } = useProfile(() => props.msg.actor);

    async function deleteMessage() {
      isDeleting.value = true;
      try {
        await graffiti.delete(props.msg, session.value);
      } finally {
        isDeleting.value = false;
      }
    }

    return { isDeleting, deleteMessage, isMine, profileName, actor: props.msg.actor };
  }
});