import { useEffect, useState } from "react";
import { KitchenPage } from "./pages/KitchenPage";
import { AdminShell } from "./pages/AdminShell";

export function usePathname(): [string, (to: string) => void] {
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = (to: string) => {
    if (to === window.location.pathname) return;
    window.history.pushState({}, "", to);
    setPath(to);
  };

  return [path, navigate];
}

export function App() {
  const [path, navigate] = usePathname();

  if (path.startsWith("/kitchen")) return <KitchenPage />;
  if (path.startsWith("/admin")) {
    return <AdminShell path={path} navigate={navigate} />;
  }

  return (
    <div className="landing">
      <h1>Harbor POS</h1>
      <p>
        <a href="/kitchen">Kitchen</a> · <a href="/admin">Admin</a>
      </p>
    </div>
  );
}
