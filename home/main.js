import { ref } from "vue";

function setup() {
  const chats = ref([1, 2]);
  const selectedChat = ref(null);

  function addChat() {
    chats.value.push(chats.value.length + 1);
  }

  return { chats, selectedChat, addChat };
}

export default async () => ({
  setup,
  template: await fetch(new URL("./index.html", import.meta.url)).then((r) =>
    r.text(),
  ),
});
