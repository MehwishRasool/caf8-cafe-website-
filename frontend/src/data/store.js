import { useEffect, useSyncExternalStore } from "react";
import { api } from "./api";

/* ---------- Settings you may want to change ---------- */
export const CURRENCY = "Rs."; // change to "$", "£", etc.
export const CATEGORIES = ["Coffee", "Cold drinks", "Breakfast", "Pastries"];

export const formatPrice = (n) =>
  `${CURRENCY} ${Number(n).toLocaleString("en-US")}`;

/* ---------- Menu (loaded from the backend) ---------- */
// status is one of: "idle", "loading", "ready", "error"
let menuState = { items: [], status: "idle" };
const menuListeners = new Set();

function setMenuState(next) {
  menuState = next;
  menuListeners.forEach((l) => l());
}

export async function loadMenu() {
  if (menuState.items.length === 0) {
    setMenuState({ items: [], status: "loading" });
  }
  try {
    const items = await api.get("/api/menu");
    setMenuState({ items, status: "ready" });
  } catch {
    setMenuState({ items: menuState.items, status: "error" });
  }
}

const subscribeMenu = (listener) => {
  menuListeners.add(listener);
  return () => menuListeners.delete(listener);
};
const getMenuState = () => menuState;

export function useMenu() {
  const state = useSyncExternalStore(subscribeMenu, getMenuState);

  useEffect(() => {
    if (menuState.status === "idle") loadMenu();
  }, []);

  return state;
}

/* ---------- Cart (saved in the browser: item id -> quantity) ---------- */
const CART_KEY = "caf8-cart-v1";
const cartListeners = new Set();

function readCart() {
  try {
    const data = JSON.parse(localStorage.getItem(CART_KEY));
    return data !== null && typeof data === "object" && !Array.isArray(data)
      ? data
      : {};
  } catch {
    return {};
  }
}

let cartState = readCart();

function setCartState(next) {
  cartState = next;
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(next));
  } catch {
    /* storage blocked or full: the cart lasts until the page closes */
  }
  cartListeners.forEach((l) => l());
}

// keeps other open tabs in sync
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === CART_KEY) {
      cartState = readCart();
      cartListeners.forEach((l) => l());
    }
  });
}

const subscribeCart = (listener) => {
  cartListeners.add(listener);
  return () => cartListeners.delete(listener);
};
const getCartState = () => cartState;

export const cartActions = {
  set(id, qty) {
    const next = { ...cartState };
    if (qty > 0) next[id] = Math.min(qty, 99);
    else delete next[id];
    setCartState(next);
  },
  clear: () => setCartState({}),
};

export function useCart() {
  const { items } = useMenu();
  const cart = useSyncExternalStore(subscribeCart, getCartState);

  // only items that still exist on the menu
  const lines = items
    .filter((i) => cart[i.id] > 0)
    .map((item) => ({ item, qty: cart[item.id] }));

  return {
    lines,
    qty: (id) => cart[id] ?? 0,
    count: lines.reduce((sum, l) => sum + l.qty, 0),
    total: lines.reduce((sum, l) => sum + l.qty * l.item.price, 0),
  };
}