import type { ReactNode } from "react";
import { NavBar, Footer } from "../shared";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="landing-root">
      <NavBar />
      {children}
      <Footer />
    </div>
  );
}
