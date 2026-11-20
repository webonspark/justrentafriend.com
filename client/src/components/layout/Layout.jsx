import { Outlet, useLocation } from "react-router-dom";
import { useEffect } from "react";
import Navbar from "./Navbar";
import Footer from "./Footer";
import BottomNav from "./BottomNav";
import PhotoNudge from "./PhotoNudge";

/**
 * The frame every page sits in.
 *
 * Changing route scrolls back to the top and moves focus to the main
 * region, so a keyboard or screen-reader user is not left at the bottom of
 * the page they just left.
 */
export default function Layout({ bare = false }) {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
    document.getElementById("main")?.focus({ preventScroll: true });
  }, [pathname]);

  return (
    <>
      <a href="#main" className="k-skip">
        Skip to content
      </a>

      <Navbar />
      <PhotoNudge />

      <main id="main" tabIndex={-1} className="k-page min-h-[60vh] outline-none">
        <Outlet />
      </main>

      {!bare && <Footer />}
      <BottomNav />
    </>
  );
}
