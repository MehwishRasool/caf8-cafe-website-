import { useEffect } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import Header from "./components/Header";
import Footer from "./components/Footer";
import DemoBanner from "./components/DemoBanner";
import ErrorBoundary from "./components/ErrorBoundary";
import Home from "./pages/Home";
import Menu from "./pages/Menu";
import Admin from "./pages/Admin";
import Reserve from "./pages/Reserve";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import Order from "./pages/Order";
import DemoPay from "./pages/DemoPay";
import Placeholder from "./pages/Placeholder";
import { useCart } from "./data/store";

const titles = {
  "/": "Caf8 | Coffee, breakfast and fresh pastries",
  "/menu": "Menu | Caf8",
  "/reserve": "Book a table | Caf8",
  "/about": "About | Caf8",
  "/contact": "Contact | Caf8",
  "/cart": "Your cart | Caf8",
  "/checkout": "Checkout | Caf8",
  "/admin": "Owner area | Caf8",
};

const descriptions = {
  "/": "Caf8 is a neighbourhood cafe serving fresh coffee, breakfast and pastries. Order for pickup or delivery, or book a table.",
  "/menu": "See the Caf8 menu: coffee, cold drinks, breakfast and fresh pastries.",
  "/reserve": "Book a table at Caf8. Only free times are shown.",
  "/about": "Our story, our people and what we care about at Caf8.",
  "/contact": "Find Caf8, see our opening hours and send us a message.",
};

const DEFAULT_DESCRIPTION =
  "Caf8: coffee, breakfast and fresh pastries. Order online or book a table.";

export default function App() {
  const { pathname } = useLocation();
  const { count } = useCart();
  const isAdmin = pathname.startsWith("/admin");

  // On every page change: jump to the top, then update the tab title and description
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title =
      titles[pathname] ??
      (pathname.startsWith("/order/")
        ? "Your order | Caf8"
        : pathname.startsWith("/demo-pay/")
          ? "Demo payment | Caf8"
          : "Page not found | Caf8");

    let tag = document.querySelector('meta[name="description"]');
    if (!tag) {
      tag = document.createElement("meta");
      tag.setAttribute("name", "description");
      document.head.appendChild(tag);
    }
    tag.setAttribute("content", descriptions[pathname] ?? DEFAULT_DESCRIPTION);
  }, [pathname]);

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-accent focus:px-4 focus:py-2 focus:font-bold focus:text-brand"
      >
        Skip to content
      </a>

      {/* the customer menu bar is not shown in the owner area */}
      {!isAdmin && <Header cartCount={count} />}

      <main
        id="main"
        className={`flex-1 ${pathname === "/" || isAdmin ? "" : "pt-16"}`}
      >
        {/* key: a page that crashed is tried again when you go to another page */}
        <ErrorBoundary key={pathname}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/menu" element={<Menu />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/reserve" element={<Reserve />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/order/:publicId" element={<Order />} />
            <Route path="/demo-pay/:publicId" element={<DemoPay />} />
            <Route
              path="*"
              element={
                <Placeholder
                  title="Page not found"
                  text="We could not find that page."
                />
              }
            />
          </Routes>
        </ErrorBoundary>
      </main>

      <Footer />

      {!isAdmin && <DemoBanner />}
    </div>
  );
}