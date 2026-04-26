import { defineStore } from "pinia";

export const useAuthStore = defineStore("auth", {
  state: () => ({
    token: localStorage.getItem("access_token") || "",
    user: JSON.parse(localStorage.getItem("user_info") || "null")
  }),
  getters: {
    isLogin: (state) => Boolean(state.token),
    role: (state) => state.user?.role || "USER"
  },
  actions: {
    setAuth(token, user) {
      this.token = token;
      this.user = user;
      localStorage.setItem("access_token", token);
      localStorage.setItem("user_info", JSON.stringify(user));
    },
    logout() {
      this.token = "";
      this.user = null;
      localStorage.removeItem("access_token");
      localStorage.removeItem("user_info");
    }
  }
});
