import { RootProvider } from "fumadocs-ui/provider/next";
import { Inter, JetBrains_Mono } from "next/font/google";
import localFont from "next/font/local";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./global.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const interDisplay = localFont({
  src: [
    {
      path: "../public/fonts/InterDisplay-Light.woff2",
      weight: "300",
      style: "normal",
    },
    {
      path: "../public/fonts/InterDisplay-Medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../public/fonts/InterDisplay-SemiBold.woff2",
      weight: "600",
      style: "normal",
    },
  ],
  variable: "--font-inter-display",
  display: "swap",
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
});

const SITE_URL = "https://utterance.dev";
const SITE_NAME = "Utterance";
const SITE_DESCRIPTION =
  "Client-side semantic endpointing for voice apps. Detect turn completion, thinking pauses, and interrupts entirely in the browser. No servers, no API keys, zero latency.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Utterance — Client-Side Semantic Endpointing for Voice Apps",
    template: "%s — Utterance",
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: "Utterance Contributors", url: SITE_URL }],
  generator: "Next.js",
  keywords: [
    "voice detection",
    "speech endpointing",
    "turn detection",
    "voice activity detection",
    "VAD",
    "web audio",
    "real-time speech",
    "client-side AI",
    "ONNX",
    "utterance SDK",
    "voice SDK",
    "speech recognition",
    "interrupt detection",
    "pause detection",
    "browser AI",
    "javascript voice",
    "typescript voice",
    "npm voice package",
  ],
  creator: "Utterance Contributors",
  publisher: "Utterance",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: "Utterance — Client-Side Semantic Endpointing for Voice Apps",
    description: SITE_DESCRIPTION,
    images: [
      {
        url: "/og-image.svg",
        width: 1200,
        height: 630,
        alt: "Utterance — Know when they finish talking",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Utterance — Client-Side Semantic Endpointing for Voice Apps",
    description: SITE_DESCRIPTION,
    images: ["/og-image.svg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: SITE_URL,
  },
  category: "technology",
};

export const viewport: Viewport = {
  themeColor: "#0a0908",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      inLanguage: "en-US",
    },
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
      logo: `${SITE_URL}/og-image.png`,
      sameAs: [
        "https://github.com/nizh0/Utterance",
        "https://discord.gg/kb4zMHNtEV",
        "https://www.npmjs.com/package/@utterance/core",
      ],
    },
    {
      "@type": "SoftwareSourceCode",
      "@id": `${SITE_URL}/#software`,
      name: "@utterance/core",
      description: SITE_DESCRIPTION,
      url: SITE_URL,
      codeRepository: "https://github.com/nizh0/Utterance",
      programmingLanguage: ["TypeScript", "JavaScript"],
      runtimePlatform: "Browser",
      license: "https://opensource.org/licenses/MIT",
      operatingSystem: "Any",
      applicationCategory: "DeveloperApplication",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
    },
  ],
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${interDisplay.variable} ${jetbrainsMono.variable} ${inter.className}`}
      suppressHydrationWarning
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="flex min-h-screen flex-col">
        <RootProvider
          search={{
            options: {
              type: "static",
            },
          }}
        >
          {children}
        </RootProvider>
      </body>
    </html>
  );
}
