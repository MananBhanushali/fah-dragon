import "./globals.css";
import { AuthProvider } from "./context/AuthContext";

export const metadata = {
  title: "Fah Dragon",
  description:
    "An atmospheric side-scrolling survival game. Pilot the Fah Dragon through pitch-black caves using plasma pulse sonar.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
