import type { Metadata } from "next"
import Link from "next/link"
import QRCode from "qrcode"
import { Download, ExternalLink, ShieldCheck, Smartphone } from "lucide-react"
import { ANDROID_APK_SHARE_URL, ANDROID_APK_URL } from "@platelink/shared"
import { Logo } from "@/components/brand/logo"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { SignOutButton } from "@/components/layout/sign-out-button"
import { getProfile } from "@/lib/auth"

export const metadata: Metadata = {
  title: "Get the Android App — Plate-Link",
  description: "Download the Plate-Link Android APK for volunteer driver dispatch, live location broadcasting, and turn-by-turn navigation.",
}

const INSTALL_STEPS = [
  {
    step: "1",
    title: "Download the APK",
    desc: "Tap the download button on your phone or scan the QR code with your camera.",
  },
  {
    step: "2",
    title: "Confirm download",
    desc: "If your browser warns that the file may be harmful, tap 'Download anyway'.",
  },
  {
    step: "3",
    title: "Allow unknown apps",
    desc: "Open the downloaded .apk file and toggle 'Allow from this source' in settings.",
  },
  {
    step: "4",
    title: "Install and sign in",
    desc: "Tap 'Install', open Plate-Link, and log in. All three roles work natively in the app.",
  },
]

export default async function GetTheApp() {
  const profile = await getProfile().catch(() => null)

  const qrSvg = await QRCode.toString(ANDROID_APK_URL, {
    type: "svg",
    margin: 1,
    color: {
      dark: "#32373B",
      light: "#FFFFFF",
    },
  })

  return (
    <div className="flex min-h-screen flex-col bg-canvas text-foreground">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {profile ? (
            <SignOutButton variant="outline" />
          ) : (
            <Button variant="ghost" asChild>
              <Link href="/login">Log in</Link>
            </Button>
          )}
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-4 inline-flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Smartphone className="size-7" />
        </div>

        <h1 className="text-center font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Get Plate-Link for Android
        </h1>
        <p className="mt-3 max-w-md text-center text-muted-foreground sm:text-base">
          Real-time GPS navigation, background location broadcasting, and live food pickup dispatch run directly on your phone.
        </p>

        <div className="mt-8 grid w-full gap-6 sm:grid-cols-[1.2fr_0.8fr]">
          {/* Direct Download Action & Install Steps */}
          <Card className="border-border/60 shadow-xs">
            <CardContent className="space-y-6 pt-6">
              <div>
                <Button size="lg" asChild className="w-full">
                  <a href={ANDROID_APK_URL} target="_blank" rel="noopener noreferrer">
                    <Download className="size-5" /> Download APK (v1.0.1)
                  </a>
                </Button>
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  Android 7.0+, v1.0.1, ~50 MB
                </p>
              </div>

              <div className="rounded-xl border bg-muted/30 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Google Play Protect note</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  If Play Protect displays a verification alert, tap <strong>More details</strong> &rarr; <strong>Install anyway</strong>. The APK is signed and built directly from this open-source repository.
                </p>
              </div>

              <div className="space-y-3">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  How to install (4 steps)
                </h2>
                <div className="space-y-2.5">
                  {INSTALL_STEPS.map((item) => (
                    <div key={item.step} className="flex items-start gap-3 rounded-lg border bg-card p-3">
                      <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 font-display text-xs font-bold text-primary">
                        {item.step}
                      </div>
                      <div className="space-y-0.5 text-xs">
                        <p className="font-semibold text-foreground">{item.title}</p>
                        <p className="text-muted-foreground leading-relaxed">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* QR Code & Drive Share link */}
          <div className="flex flex-col items-center justify-between rounded-xl border border-border/60 bg-card p-6 shadow-xs">
            <div className="flex flex-col items-center text-center">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Scan with phone camera
              </span>
              <p className="mt-1 text-xs text-muted-foreground">
                Point your mobile camera at this code to download immediately.
              </p>

              <div
                className="mt-4 size-48 rounded-xl bg-white p-2 shadow-xs ring-1 ring-border/80 [&>svg]:size-full"
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
            </div>

            <div className="mt-6 w-full border-t border-border/60 pt-4 text-center">
              <a
                href={ANDROID_APK_SHARE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-link hover:underline"
              >
                <span>View on Google Drive</span>
                <ExternalLink className="size-3" />
              </a>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-border/60 py-6 text-center text-xs text-muted-foreground">
        Plate-Link &bull; Built with care by Jynxx &bull; Released under the MIT License
      </footer>
    </div>
  )
}
