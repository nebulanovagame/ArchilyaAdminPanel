import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { logAnalyticsEvent } from './firebase';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import ProductFeatures from './components/ProductFeatures';
import Features from './components/Features';
import BeforeAfter from './components/BeforeAfter';
import Portfolio from './components/Portfolio';
import Workflow from './components/Workflow';
import Services from './components/Services';
import PricingCalculator from './components/PricingCalculator';
import Contact from './components/Contact';
import Footer from './components/Footer';
import Preloader from './components/Preloader';
import CustomCursor from './components/CustomCursor';
import ArchilyaAIAssistant from './components/ArchilyaAIAssistant';
import ComingSoon from './components/ComingSoon';
import {
  GizlilikPolitikasi,
  KVKK,
  KullanimKosullari,
  IptalIade,
  MesafeliSatis,
  Hakkimizda,
} from './pages/LegalPages';

function HomePage() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isLoading) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [isLoading]);

  return (
    <div className="min-h-screen bg-background text-white selection:bg-primary/30 selection:text-white">
      <AnimatePresence mode="wait">
        {isLoading && <Preloader onComplete={() => setIsLoading(false)} />}
      </AnimatePresence>

      {!isLoading && (
        <>
          <Navbar />
          <main>
            <Hero />
            <ProductFeatures />
            <Features />
            <BeforeAfter />
            <Services />
            <Portfolio />
            <Workflow />
            <PricingCalculator />
            <Contact />
          </main>
          <Footer />
        </>
      )}
    </div>
  );
}

function RouteAnalyticsTracker() {
  const location = useLocation();

  useEffect(() => {
    const pagePath = `${location.pathname}${location.search || ''}${location.hash || ''}`;
    logAnalyticsEvent('page_view', {
      page_path: pagePath,
      page_title: typeof document !== 'undefined' ? document.title : 'Archilya',
      page_location: typeof window !== 'undefined' ? window.location.href : pagePath,
    });
  }, [location]);

  return null;
}

function SiteNotFound() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background px-6 py-10 text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(198,168,124,0.16),transparent_42%)]" />
        <div className="absolute left-1/2 top-24 h-56 w-56 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="relative mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-4xl flex-col items-center justify-center text-center"
      >
        <div className="mb-8 inline-flex flex-col items-center gap-2">
          <span className="text-[10px] uppercase tracking-[0.3em] text-primary/80">Archilya</span>
          <span className="font-serif text-3xl italic tracking-[0.08em] text-white">Archilya</span>
        </div>

        <div className="mb-6 flex flex-col items-center">
          <p className="mb-4 text-[10px] uppercase tracking-[0.32em] text-primary/75">Sayfa Bulunamadı</p>
          <h1 className="font-serif text-[7rem] italic leading-none text-primary/22 sm:text-[9rem] md:text-[11rem]">404</h1>
        </div>

        <div className="max-w-xl space-y-4">
          <h2 className="font-serif text-3xl italic text-white sm:text-4xl">Aradığınız sayfa bulunamadı</h2>
        </div>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to="/"
            className="inline-flex min-w-[220px] items-center justify-center rounded-sm bg-primary px-6 py-3 text-[10px] font-bold uppercase tracking-[0.28em] text-black transition-colors hover:bg-white"
          >
            Ana Sayfaya Dön
          </Link>
          <Link
            to="/panel"
            className="inline-flex min-w-[220px] items-center justify-center rounded-sm border border-white/15 bg-white/[0.02] px-6 py-3 text-[10px] font-bold uppercase tracking-[0.28em] text-white transition-colors hover:border-primary/40 hover:text-primary"
          >
            Panel Girişine Git
          </Link>
        </div>
      </motion.div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <RouteAnalyticsTracker />
      <CustomCursor />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/panel" element={<ComingSoon />} />
        <Route path="/gizlilik-politikasi" element={<GizlilikPolitikasi />} />
        <Route path="/kvkk" element={<KVKK />} />
        <Route path="/kullanim-kosullari" element={<KullanimKosullari />} />
        <Route path="/iptal-iade" element={<IptalIade />} />
        <Route path="/mesafeli-satis" element={<MesafeliSatis />} />
        <Route path="/hakkimizda" element={<Hakkimizda />} />
        <Route path="*" element={<SiteNotFound />} />
      </Routes>
      <ArchilyaAIAssistant />
    </BrowserRouter>
  );
}

export default App;
