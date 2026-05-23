import { Toaster } from "react-hot-toast";

export default async function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      {children}
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "#1a1c23",
            color: "#e2e2e2",
            border: "1px solid rgba(255,255,255,0.05)",
            borderRadius: 0,
            fontSize: "14px",
            fontFamily: "var(--font-montserrat), sans-serif",
          },
          success: {
            iconTheme: {
              primary: "#c6a87c",
              secondary: "#1a1c23",
            },
          },
          error: {
            iconTheme: {
              primary: "#ef4444",
              secondary: "#1a1c23",
            },
          },
        }}
      />
    </>
  );
}
