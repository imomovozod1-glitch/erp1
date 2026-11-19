import { landingContext } from '@/components/landing/landing-content'
import { TEXT_STRONG } from '@/components/landing/landing-theme'
import { MobileCta } from '@/components/landing/mobile-cta'
import { NativeAppRedirect } from '@/components/landing/native-app-redirect'
import { LandingDetails } from '@/components/landing/sections/details'
import { LandingFooter, LandingSignup } from '@/components/landing/sections/start'
import { LandingSegments, LandingStory } from '@/components/landing/sections/story'
import { LandingHeader, LandingHero } from '@/components/landing/sections/top'

/**
 * The public marketing page on the bare host (falco.business / www.); tenant subdomains keep
 * redirecting to their dashboard. Glass over an animated aurora, in the app's own light and
 * dark theme; the `lp-*` styles Tailwind cannot express live at the end of globals.css.
 * Server-rendered except the scroll reveal, the stacked cards, the menu and the form; the
 * `landing` namespace is server-only, so none of this text reaches tenant pages.
 *
 * Contacts come from the environment (see `contactLinks`): LANDING_CONTACT_PHONE,
 * LANDING_CONTACT_TELEGRAM, LANDING_APK_URL, LANDING_IOS_URL.
 */
export async function LandingPage({ lang }: { lang: string }) {
  const ctx = await landingContext(lang)
  return (
    <div className={`lp relative min-h-screen ${TEXT_STRONG}`}>
      {/* Inside the Android app this page is not for the person holding it: they go straight to
          sign in, before anything is painted. NativeAppRedirect covers a WebView that injects
          Capacitor only after the document has started. */}
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){try{var c=window.Capacitor;if(c&&c.isNativePlatform&&c.isNativePlatform())location.replace(${JSON.stringify(ctx.loginHref)})}catch(e){}})()`,
        }}
      />
      <NativeAppRedirect href={ctx.loginHref} />
      <LandingHeader ctx={ctx} />
      <main id="top">
        <LandingHero ctx={ctx} />
        <LandingStory ctx={ctx} />
        <LandingSegments ctx={ctx} />
        <LandingDetails ctx={ctx} />
        <LandingSignup ctx={ctx} />
      </main>
      <LandingFooter ctx={ctx} />
      <MobileCta label={ctx.t('ctaStart')} callLabel={ctx.t('ctaCall')} phoneHref={ctx.contact.phone} />
    </div>
  )
}
