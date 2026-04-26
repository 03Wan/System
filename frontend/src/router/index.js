import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "../stores/auth";

const LoginView = () => import("../views/LoginView.vue");
const MainLayout = () => import("../layouts/MainLayout.vue");

const UserHome = () => import("../views/user/UserHome.vue");
const UploadPage = () => import("../views/user/UploadPage.vue");
const ResultPage = () => import("../views/user/ResultPage.vue");
const HistoryPage = () => import("../views/user/HistoryPage.vue");

const AdminHome = () => import("../views/admin/AdminHome.vue");
const UserManagePage = () => import("../views/admin/UserManagePage.vue");
const TemplateManagePage = () => import("../views/admin/TemplateManagePage.vue");
const DataStatsPage = () => import("../views/admin/DataStatsPage.vue");

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/login", component: LoginView, meta: { public: true } },
    {
      path: "/",
      component: MainLayout,
      children: [
        { path: "", redirect: "/user/home" },
        { path: "user/home", component: UserHome, meta: { role: "USER" } },
        { path: "user/upload", component: UploadPage, meta: { role: "USER" } },
        { path: "user/result", component: ResultPage, meta: { role: "USER" } },
        { path: "user/history", component: HistoryPage, meta: { role: "USER" } },

        { path: "admin/home", component: AdminHome, meta: { role: "ADMIN" } },
        { path: "admin/users", component: UserManagePage, meta: { role: "ADMIN" } },
        { path: "admin/templates", component: TemplateManagePage, meta: { role: "ADMIN" } },
        { path: "admin/stats", component: DataStatsPage, meta: { role: "ADMIN" } }
      ]
    }
  ]
});

router.beforeEach((to, from, next) => {
  const store = useAuthStore();
  if (to.meta.public) {
    next();
    return;
  }
  if (!store.isLogin) {
    next("/login");
    return;
  }
  const targetRole = String(to.meta.role || "").toUpperCase();
  const currentRole = String(store.role || "").toUpperCase();
  if (targetRole && targetRole !== currentRole) {
    next(store.role === "ADMIN" ? "/admin/home" : "/user/home");
    return;
  }
  next();
});

export default router;
