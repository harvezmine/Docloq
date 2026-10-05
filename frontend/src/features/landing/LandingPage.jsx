import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, AnimatePresence } from 'framer-motion';
import '@fontsource-variable/fraunces';
import '@fontsource-variable/fraunces/wght-italic.css';
import InteractiveRobotSpline from '@/components/ui/InteractiveRobotSpline';
import { ContainerScroll } from '@/components/ui/ContainerScrollAnimation';
import { SparklesCore } from '@/components/ui/SparklesCore';
import { useLang } from '@/app/providers/LanguageProvider';
import SectionLabel from './components/SectionLabel';
import SecurityMarquee from './components/SecurityMarquee';
import FeatureBento from './components/FeatureBento';
import SmoothScrollProvider, { useLenis } from './SmoothScrollProvider';
import LandingBackdrop from './LandingBackdrop';
import Preloader from './hero/Preloader';
import SceneErrorBoundary from './hero/SceneErrorBoundary';
import WelcomeGate from './hero/WelcomeGate';
import HeroSection from './hero/HeroSection';

const VIEWPORT = { once: false, amount: 0.25 };

export default function LandingPage() {
  return (
    <SmoothScrollProvider>
      <LandingContent />
    </SmoothScrollProvider>
  );
}

function LandingContent() {
  const { t } = useLang();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const [navSolid, setNavSolid] = useState(false);
  useEffect(() => {
    const onScroll = () => setNavSolid(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const [phase, setPhase] = useState('loading');
  const howRef = useRef(null);
  const lenis = useLenis();
  const { scrollYProgress: howProgress } = useScroll({ target: howRef, offset: ['start 0.75', 'end 0.55'] });

  useEffect(() => {
    const loadingTimer = setTimeout(() => setPhase('welcome'), 1600);
    return () => clearTimeout(loadingTimer);
  }, []);

  const locked = phase !== 'entered';
  useEffect(() => {
    const setLock = (on) => {
      document.documentElement.style.overflow = on ? 'hidden' : '';
      document.body.style.overflow = on ? 'hidden' : '';
    };
    if (locked) {
      lenis?.stop();
      setLock(true);
    } else {
      lenis?.start();
      setLock(false);
    }
    return () => {
      lenis?.start();
      setLock(false);
    };
  }, [locked, lenis]);

  const handleAnchor = (e, hash) => {
    e.preventDefault();
    setIsMenuOpen(false);

    window.dispatchEvent(new Event('lp:gate-bypass'));
    if (lenis) lenis.scrollTo(hash, { offset: -80, duration: 1.4 });
    else document.querySelector(hash)?.scrollIntoView({ behavior: 'smooth' });
  };

  const stats = [
    { value: "AES-256", label: t("landing.stats.encryption") },
    { value: "SHA-256", label: t("landing.stats.blockchainHash") },
    { value: "<100ms", label: t("landing.stats.verificationTime") },
    { value: "100%", label: t("landing.stats.tamperDetection") },
    { value: "2FA", label: t("landing.stats.accountSecurity") },
    { value: "Vault", label: t("landing.stats.keyManagement") },
    { value: "ClamAV", label: t("landing.stats.malwareScan") },
    { value: "R2", label: t("landing.stats.encryptedStorage") },
  ];

  return (
    <>
      
      <AnimatePresence>{phase === 'loading' && <Preloader />}</AnimatePresence>

      {(phase === 'welcome' || phase === 'entering') && (
        <WelcomeGate
          onEnterStart={() => setPhase('entering')}
          onEntered={() => setPhase('entered')}
        />
      )}

      <div className="min-h-dvh bg-[#05060D] text-white overflow-x-clip">
        
        <LandingBackdrop />

      <nav className="fixed w-full z-50 transition-all duration-300">
        
        <div
          className={`absolute inset-0 bg-linear-to-b from-[#05060D]/90 via-[#05060D]/45 to-transparent transition-opacity duration-300 ${navSolid ? 'opacity-0' : 'opacity-100'}`}
        />
        
        <div className={`absolute inset-0 transition-opacity duration-300 ${navSolid ? 'opacity-100' : 'opacity-0'}`}>
          <div className="absolute inset-0 bg-[#05060D]/75 backdrop-blur-xl" />
          <div className="absolute inset-x-0 bottom-0 h-px bg-linear-to-r from-transparent via-violet-500/40 to-transparent" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <motion.div 
              className="flex items-center"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="relative">
                <div className="absolute -inset-2 bg-gradient-to-r from-violet-600 to-cyan-600 rounded-lg blur opacity-30" />
                <h1 className="relative text-2xl font-bold bg-gradient-to-r from-violet-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
                  Docloq
                </h1>
              </div>
            </motion.div>

            <motion.div 
              className="hidden md:flex items-center space-x-8"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              {[
                ['#features', t("landing.nav.features")],
                ['#how-it-works', t("landing.nav.howItWorks")],
                ['#security', t("landing.nav.security")],
              ].map(([hash, label]) => (
                <a
                  key={hash}
                  href={hash}
                  onClick={(e) => handleAnchor(e, hash)}
                  className="relative text-slate-400 hover:text-white transition-colors after:absolute after:left-0 after:-bottom-1.5 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-linear-to-r after:from-violet-400 after:to-cyan-400 after:transition-transform after:duration-300 hover:after:scale-x-100"
                >
                  {label}
                </a>
              ))}
              <Link
                to="/contact"
                className="relative text-slate-400 hover:text-white transition-colors after:absolute after:left-0 after:-bottom-1.5 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-linear-to-r after:from-violet-400 after:to-cyan-400 after:transition-transform after:duration-300 hover:after:scale-x-100"
              >
                {t("landing.nav.contact")}
              </Link>
            </motion.div>

            <motion.div
              className="hidden md:flex items-center space-x-4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Link
                to="/login"
                className="text-slate-300 hover:text-white px-4 py-2 rounded-lg font-medium transition-all hover:bg-white/5"
              >
                {t("landing.nav.signIn")}
              </Link>
              <Link
                to="/contact"
                className="relative group"
              >
                <div className="absolute -inset-0.5 bg-gradient-to-r from-violet-600 to-cyan-600 rounded-lg blur opacity-60 group-hover:opacity-100 transition duration-300" />
                <span className="relative flex items-center px-6 py-2.5 bg-slate-950 rounded-lg font-medium text-white group-hover:bg-slate-900 transition-colors">
                  {t("landing.nav.requestAccess")}
                  <svg className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </span>
              </Link>
            </motion.div>

            <button 
              className="md:hidden text-white p-2"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden bg-slate-900/95 backdrop-blur-xl border-b border-white/5"
            >
              <div className="px-4 py-6 space-y-4">
                <a href="#features" onClick={(e) => handleAnchor(e, '#features')} className="block text-slate-300 hover:text-white py-2">{t("landing.nav.features")}</a>
                <a href="#how-it-works" onClick={(e) => handleAnchor(e, '#how-it-works')} className="block text-slate-300 hover:text-white py-2">{t("landing.nav.howItWorks")}</a>
                <a href="#security" onClick={(e) => handleAnchor(e, '#security')} className="block text-slate-300 hover:text-white py-2">{t("landing.nav.security")}</a>
                <Link to="/contact" className="block text-slate-300 hover:text-white py-2">{t("landing.nav.contact")}</Link>
                <div className="pt-4 space-y-3">
                  <Link to="/login" className="block text-center py-3 text-white border border-white/20 rounded-lg">{t("landing.nav.signIn")}</Link>
                  <Link to="/contact" className="block text-center py-3 bg-gradient-to-r from-violet-600 to-cyan-600 text-white rounded-lg">{t("landing.nav.requestAccess")}</Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      <HeroSection phase={phase} />

      <SecurityMarquee items={stats} />

      <div data-mood="platform">
      <ContainerScroll
        titleComponent={
          <>
            <SectionLabel index="01" title={t("landing.platform.label")} accent="text-cyan-400" align="center" />
            <h2 className="text-4xl md:text-[3.5rem] font-bold text-white leading-tight">
              {t("landing.platform.headingA")}{' '}
              <span className="bg-linear-to-r from-violet-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
                Docloq
              </span>
              {'?'}
            </h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto mt-4">
              {t("landing.platform.intro")}
            </p>
          </>
        }
      >
        
        <div className="h-full w-full p-6 md:p-10 flex flex-col gap-6 overflow-hidden">
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-linear-to-br from-violet-600 to-cyan-600 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                D
              </div>
              <div>
                <span className="text-white font-semibold text-lg">{t("landing.platform.platformName")}</span>
                <p className="text-slate-500 text-xs">{t("landing.platform.tagline")}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-medium flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {t("landing.platform.allSystemsActive")}
              </span>
            </div>
          </div>

          <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
            
            <div className="rounded-2xl bg-violet-500/10 border border-violet-500/20 p-5 flex flex-col">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <h4 className="text-white font-semibold text-sm">{t("landing.platform.aiEngine")}</h4>
              </div>
              <div className="space-y-2 flex-1">
                <div className="flex justify-between text-xs"><span className="text-slate-400">{t("landing.platform.analysis")}</span><span className="text-violet-400 font-bold">98%</span></div>
                <div className="w-full h-1.5 rounded-full bg-slate-800"><div className="h-full rounded-full bg-violet-500" style={{ width: '98%' }} /></div>
                <div className="flex justify-between text-xs"><span className="text-slate-400">{t("landing.platform.summary")}</span><span className="text-violet-400 font-bold">95%</span></div>
                <div className="w-full h-1.5 rounded-full bg-slate-800"><div className="h-full rounded-full bg-violet-500/70" style={{ width: '95%' }} /></div>
                <div className="flex justify-between text-xs"><span className="text-slate-400">{t("landing.platform.extraction")}</span><span className="text-violet-400 font-bold">99%</span></div>
                <div className="w-full h-1.5 rounded-full bg-slate-800"><div className="h-full rounded-full bg-violet-500/50" style={{ width: '99%' }} /></div>
              </div>
              <div className="mt-3 text-center">
                <span className="text-2xl font-bold text-violet-400">50+</span>
                <p className="text-[10px] text-slate-500">{t("landing.platform.languagesSupported")}</p>
              </div>
            </div>

            <div className="rounded-2xl bg-cyan-500/10 border border-cyan-500/20 p-5 flex flex-col">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h4 className="text-white font-semibold text-sm">{t("landing.platform.blockchain")}</h4>
              </div>
              <div className="space-y-3 flex-1">
                {[
                  { hash: '0x7a3f...', status: t("landing.platform.verified"), color: 'text-cyan-400' },
                  { hash: '0x9b2e...', status: t("landing.platform.verified"), color: 'text-cyan-400' },
                  { hash: '0xc4d1...', status: t("landing.platform.pending"), color: 'text-amber-400' },
                ].map((block, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-900/60 border border-white/5">
                    <span className="text-xs font-mono text-slate-400">{block.hash}</span>
                    <span className={`text-[10px] font-semibold ${block.color}`}>{block.status}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 text-center">
                <span className="text-2xl font-bold text-cyan-400">SHA-256</span>
                <p className="text-[10px] text-slate-500">{t("landing.platform.hashAlgorithm")}</p>
              </div>
            </div>

            <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-5 flex flex-col">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h4 className="text-white font-semibold text-sm">{t("landing.platform.security")}</h4>
              </div>
              <div className="space-y-2 flex-1">
                {[
                  { label: t("landing.platform.aesEncryption"), icon: (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  ), active: true },
                  { label: t("landing.platform.honeytokenTraps"), icon: (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  ), active: true },
                  { label: t("landing.platform.osintScanner"), icon: (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  ), active: true },
                  { label: t("landing.platform.secureWiping"), icon: (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  ), active: true },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-slate-900/60 border border-white/5">
                    <span className="text-xs text-slate-300 flex items-center gap-2">
                      <span className="text-emerald-400">{item.icon}</span>
                      {item.label}
                    </span>
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  </div>
                ))}
              </div>
              <div className="mt-3 text-center">
                <span className="text-2xl font-bold text-emerald-400">100%</span>
                <p className="text-[10px] text-slate-500">{t("landing.platform.tamperDetection")}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/5 border border-white/5">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
                <span className="text-xs text-slate-400">{t("landing.platform.aiActive")}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                <span className="text-xs text-slate-400">{t("landing.platform.chainSynced")}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs text-slate-400">{t("landing.platform.secure")}</span>
              </div>
            </div>
            <span className="text-xs text-slate-500">{t("landing.platform.versionEncrypted")}</span>
          </div>
        </div>
      </ContainerScroll>
      </div>

      <section data-mood="doki" className="relative py-32 overflow-hidden">
        
        <div className="absolute inset-0 bg-linear-to-b from-transparent via-fuchsia-950/10 to-transparent" />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-violet-600/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-fuchsia-600/5 rounded-full blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8 }}
              viewport={VIEWPORT}
              className="relative aspect-square max-w-lg mx-auto lg:mx-0"
            >
              
              <div className="absolute inset-10 bg-linear-to-br from-violet-600/20 via-fuchsia-600/20 to-cyan-600/20 rounded-full blur-3xl" />

              <SceneErrorBoundary
                fallback={
                  <div className="w-full h-full relative z-10 flex items-center justify-center">
                    <div className="w-48 h-48 rounded-full bg-gradient-to-br from-violet-600/30 to-cyan-600/30 blur-2xl" />
                  </div>
                }
              >
                <InteractiveRobotSpline
                  scene="https://prod.spline.design/PyzDhpQ9E5f1E3MT/scene.splinecode"
                  className="w-full h-full relative z-10"
                />
              </SceneErrorBoundary>
            </motion.div>

            <div>
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                viewport={VIEWPORT}
              >
                <SectionLabel index="02" title={t("landing.doki.label")} accent="text-fuchsia-400" />
                <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
                  {t("landing.doki.headingA")}<br />
                  <span className="bg-linear-to-r from-fuchsia-400 via-violet-400 to-cyan-400 bg-clip-text text-transparent">
                    {t("landing.doki.headingB")}
                  </span>
                </h2>
                <p className="text-slate-400 text-lg leading-relaxed mb-10">
                  {t("landing.doki.intro")}
                </p>
              </motion.div>

              <div className="space-y-5">
                {[
                  {
                    title: t("landing.doki.feature1Title"),
                    desc: t("landing.doki.feature1Desc"),
                    iconBg: 'bg-violet-500/15 border-violet-500/25',
                    iconColor: 'text-violet-400',
                  },
                  {
                    title: t("landing.doki.feature2Title"),
                    desc: t("landing.doki.feature2Desc"),
                    iconBg: 'bg-fuchsia-500/15 border-fuchsia-500/25',
                    iconColor: 'text-fuchsia-400',
                  },
                  {
                    title: t("landing.doki.feature3Title"),
                    desc: t("landing.doki.feature3Desc"),
                    iconBg: 'bg-cyan-500/15 border-cyan-500/25',
                    iconColor: 'text-cyan-400',
                  },
                ].map((feat, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: 30 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, delay: i * 0.05 }}
                    viewport={VIEWPORT}
                    className="group flex items-start gap-4 p-4 -mx-4 rounded-2xl hover:bg-white/5 transition-colors duration-300"
                  >
                    <div className={`mt-1 w-10 h-10 rounded-xl ${feat.iconBg} border flex items-center justify-center shrink-0`}>
                      <svg className={`w-5 h-5 ${feat.iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-white font-semibold mb-1">{feat.title}</h4>
                      <p className="text-slate-400 text-sm leading-relaxed">{feat.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" data-mood="features" className="relative py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="mb-16 max-w-3xl">
            <SectionLabel index="03" title={t("landing.features.label")} accent="text-violet-400" />
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              viewport={VIEWPORT}
              className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6"
            >
              <span className="text-white">{t("landing.features.headingA")}</span>{' '}
              <span className="bg-linear-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
                {t("landing.features.headingB")}
              </span>
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              viewport={VIEWPORT}
              className="text-xl text-slate-400"
            >
              {t("landing.features.intro")}
            </motion.p>
          </div>

          <FeatureBento />
        </div>
      </section>

      <section data-mood="analysis" className="relative py-32 overflow-hidden">
        
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgb(139, 92, 246) 1px, transparent 0)`,
            backgroundSize: '40px 40px',
          }} />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              viewport={VIEWPORT}
            >
              <SectionLabel index="04" title={t("landing.aiSection.label")} accent="text-violet-400" />
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
                {t("landing.aiSection.headingA")}
                <br />
                <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                  {t("landing.aiSection.headingB")}
                </span>
              </h2>
              <p className="text-xl text-slate-400 mb-8 leading-relaxed">
                {t("landing.aiSection.introA")}{' '}
                {t("landing.aiSection.introGet")} <span className="text-violet-400 font-medium">{t("landing.aiSection.introVisual")}</span> {t("landing.aiSection.introB")}
              </p>

              <div className="grid grid-cols-2 gap-4 mb-8">
                {[
                  { icon: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>), title: t("landing.aiSection.card1Title"), desc: t("landing.aiSection.card1Desc") },
                  { icon: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>), title: t("landing.aiSection.card2Title"), desc: t("landing.aiSection.card2Desc") },
                  { icon: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>), title: t("landing.aiSection.card3Title"), desc: t("landing.aiSection.card3Desc") },
                  { icon: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>), title: t("landing.aiSection.card4Title"), desc: t("landing.aiSection.card4Desc") },
                ].map((item, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.05 }}
                    viewport={VIEWPORT}
                    className="p-4 bg-slate-900/50 rounded-xl border border-white/5 hover:border-violet-500/30 transition-colors"
                  >
                    <span className="text-violet-400 mb-2 block">{item.icon}</span>
                    <h4 className="text-white font-semibold mb-1">{item.title}</h4>
                    <p className="text-slate-500 text-sm">{item.desc}</p>
                  </motion.div>
                ))}
              </div>

              <Link
                to="/contact"
                className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 rounded-xl text-white font-semibold hover:from-violet-500 hover:to-fuchsia-500 transition-all"
              >
                {t("landing.aiSection.tryButton")}
                <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              viewport={VIEWPORT}
              className="relative"
            >
              <div className="absolute -inset-4 bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20 rounded-3xl blur-3xl" />
              <div className="relative bg-slate-900/80 backdrop-blur-sm rounded-3xl border border-white/10 p-6 overflow-hidden">
                
                <div className="space-y-4">
                  
                  <div className="flex items-center justify-between pb-4 border-b border-white/10">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center">
                        <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-white font-medium">Q4_Report.pdf</p>
                        <p className="text-xs text-slate-500">{t("landing.aiSection.analyzedJustNow")}</p>
                      </div>
                    </div>
                    <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded-full">{t("landing.aiSection.complete")}</span>
                  </div>

                  <div className="p-4 bg-slate-800/50 rounded-xl">
                    <p className="text-xs text-violet-400 font-medium mb-2">{t("landing.aiSection.aiSummaryLabel")}</p>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      {t("landing.aiSection.summaryText")}
                    </p>
                  </div>

                  <div className="p-4 bg-slate-800/50 rounded-xl">
                    <p className="text-xs text-violet-400 font-medium mb-3">{t("landing.aiSection.extractedMetrics")}</p>
                    <div className="flex items-end gap-2 h-20">
                      {[40, 55, 45, 70, 65, 85, 90].map((height, i) => (
                        <motion.div
                          key={i}
                          initial={{ height: 0 }}
                          whileInView={{ height: `${height}%` }}
                          transition={{ duration: 0.5, delay: i * 0.05 }}
                          viewport={VIEWPORT}
                          className="flex-1 bg-gradient-to-t from-violet-600 to-fuchsia-500 rounded-t"
                        />
                      ))}
                    </div>
                    <div className="flex justify-between mt-2 text-xs text-slate-500">
                      <span>Q1</span>
                      <span>Q2</span>
                      <span>Q3</span>
                      <span>Q4</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: t("landing.aiSection.metricSentiment"), value: t("landing.aiSection.metricSentimentValue"), color: "text-emerald-400" },
                      { label: t("landing.aiSection.metricRisk"), value: t("landing.aiSection.metricRiskValue"), color: "text-cyan-400" },
                      { label: t("landing.aiSection.metricConfidence"), value: "94%", color: "text-violet-400" },
                    ].map((metric, i) => (
                      <div key={i} className="p-3 bg-slate-800/50 rounded-lg text-center">
                        <p className="text-xs text-slate-500 mb-1">{metric.label}</p>
                        <p className={`text-sm font-semibold ${metric.color}`}>{metric.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section id="how-it-works" data-mood="how" className="relative py-32">
        
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none bg-slate-900/15 [mask-image:linear-gradient(to_bottom,transparent,black_12%,black_88%,transparent)]"
        />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="mb-20">
            <SectionLabel index="05" title={t("landing.how.label")} accent="text-cyan-400" />
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              viewport={VIEWPORT}
              className="text-4xl md:text-5xl lg:text-6xl font-bold text-white"
            >
              {t("landing.how.headingA")}<br />
              <span className="bg-linear-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">{t("landing.how.headingB")}</span>
            </motion.h2>
          </div>

          <div ref={howRef} className="relative pl-8 sm:pl-12">
            
            <div aria-hidden="true" className="absolute left-2 sm:left-3 top-2 bottom-2 w-px bg-slate-800">
              <motion.div
                style={{ scaleY: howProgress }}
                className="w-full h-full origin-top bg-gradient-to-b from-violet-500 via-cyan-500 to-emerald-500"
              />
            </div>

            <div className="space-y-20">
              {[
                {
                  step: '01',
                  meta: t("landing.how.step1Meta"),
                  title: t("landing.how.step1Title"),
                  desc: t("landing.how.step1Desc"),
                  accent: 'text-violet-400',
                  dot: 'bg-violet-400',
                },
                {
                  step: '02',
                  meta: t("landing.how.step2Meta"),
                  title: t("landing.how.step2Title"),
                  desc: t("landing.how.step2Desc"),
                  accent: 'text-cyan-400',
                  dot: 'bg-cyan-400',
                },
                {
                  step: '03',
                  meta: t("landing.how.step3Meta"),
                  title: t("landing.how.step3Title"),
                  desc: t("landing.how.step3Desc"),
                  accent: 'text-emerald-400',
                  dot: 'bg-emerald-400',
                },
              ].map((item, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: 40 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.6, delay: 0.1 }}
                  viewport={{ once: false, amount: 0.2, margin: '-80px' }}
                  className="relative grid sm:grid-cols-12 gap-4 sm:gap-8 items-start"
                >
                  
                  <span aria-hidden="true" className={`absolute -left-8 sm:-left-12 top-3 ml-[5px] sm:ml-[7px] w-3 h-3 rounded-full ${item.dot} ring-4 ring-slate-950`} />

                  <div className="sm:col-span-3">
                    <span className="lp-ghost-number font-black text-7xl sm:text-8xl leading-none select-none">{item.step}</span>
                  </div>

                  <div className="sm:col-span-9">
                    <p className={`font-mono text-[11px] tracking-[0.25em] uppercase mb-2 ${item.accent}`}>{item.meta}</p>
                    <h3 className="text-2xl sm:text-3xl font-bold text-white mb-3">{item.title}</h3>
                    <p className="text-slate-400 leading-relaxed max-w-xl">{item.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section data-mood="chain" className="relative py-32 overflow-hidden">
        
        <div className="absolute inset-0 opacity-10 [mask-image:linear-gradient(to_bottom,transparent,black_15%,black_85%,transparent)]">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%2310b981' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }} />
        </div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              viewport={VIEWPORT}
              className="relative order-2 lg:order-1"
            >
              <div className="absolute -inset-4 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 rounded-3xl blur-3xl" />
              <div className="relative bg-slate-900/80 backdrop-blur-sm rounded-3xl border border-white/10 p-8">
                
                <div className="flex flex-col items-center space-y-4">
                  {[1, 2, 3].map((block, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, scale: 0.8 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.5, delay: index * 0.07 }}
                      viewport={VIEWPORT}
                      className="w-full"
                    >
                      {index > 0 && (
                        <div className="flex justify-center mb-4">
                          <motion.div 
                            className="w-0.5 h-8 bg-gradient-to-b from-emerald-500 to-cyan-500"
                            animate={{ opacity: [0.5, 1, 0.5] }}
                            transition={{ duration: 2, repeat: Infinity, delay: index * 0.3 }}
                          />
                        </div>
                      )}
                      <div className="relative group">
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-xl blur opacity-30 group-hover:opacity-60 transition" />
                        <div className="relative bg-slate-800 rounded-xl p-4 border border-emerald-500/30">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-emerald-400 font-mono">{t("landing.chain.blockLabel")}{2024100 + index}</span>
                            <span className="text-xs text-slate-500 inline-flex items-center gap-1">{t("landing.chain.blockVerified")}
                              <svg className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 font-mono truncate mb-2">
                            {t("landing.chain.hashLabel")} 0x{['7a3f2d8e9c4b1a5f6d2e', '8b4c3e9f2a1d5c6b7e8f', '9c5d4f0a3b2e6d7c8f9a'][index]}...
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-500">{['Contract.pdf', 'Invoice.pdf', 'Report.docx'][index]}</span>
                            <div className="flex items-center space-x-1">
                              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                              <span className="text-xs text-emerald-400">{t("landing.chain.blockImmutable")}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              viewport={VIEWPORT}
              className="order-1 lg:order-2"
            >
              <SectionLabel index="06" title={t("landing.chain.label")} accent="text-emerald-400" />
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
                {t("landing.chain.headingA")}
                <br />
                <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                  {t("landing.chain.headingB")}
                </span>
              </h2>
              <p className="text-xl text-slate-400 mb-8 leading-relaxed">
                {t("landing.chain.introA")} <span className="text-emerald-400 font-medium">{t("landing.chain.introHighlight")}</span> {t("landing.chain.introB")}
              </p>

              <div className="space-y-4">
                {[
                  { title: t("landing.chain.item1Title"), desc: t("landing.chain.item1Desc") },
                  { title: t("landing.chain.item2Title"), desc: t("landing.chain.item2Desc") },
                  { title: t("landing.chain.item3Title"), desc: t("landing.chain.item3Desc") },
                  { title: t("landing.chain.item4Title"), desc: t("landing.chain.item4Desc") },
                ].map((item, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.05 }}
                    viewport={VIEWPORT}
                    className="flex items-start space-x-3"
                  >
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center mt-0.5">
                      <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <span className="text-white font-medium">{item.title}</span>
                      <p className="text-sm text-slate-500">{item.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.15 }}
                viewport={VIEWPORT}
                className="mt-8"
              >
                <Link
                  to="/contact"
                  className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-emerald-600 to-cyan-600 rounded-xl text-white font-semibold hover:from-emerald-500 hover:to-cyan-500 transition-all"
                >
                  {t("landing.chain.verifyButton")}
                  <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </Link>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      <section id="security" data-mood="security" className="relative py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              viewport={VIEWPORT}
            >
              <SectionLabel index="07" title={t("landing.securitySection.label")} accent="text-emerald-400" />
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
                {t("landing.securitySection.headingA")}
                <br />
                <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                  {t("landing.securitySection.headingB")}
                </span>
              </h2>
              <p className="text-xl text-slate-400 mb-8 leading-relaxed">
                {t("landing.securitySection.intro")}
              </p>

              <div className="space-y-4">
                {[
                  t("landing.securitySection.item1"),
                  t("landing.securitySection.item2"),
                  t("landing.securitySection.item3"),
                  t("landing.securitySection.item4"),
                ].map((item, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.05 }}
                    viewport={VIEWPORT}
                    className="flex items-center space-x-3"
                  >
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                      <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-slate-300">{item}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              viewport={VIEWPORT}
              className="relative"
            >
              <div className="absolute -inset-4 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 rounded-3xl blur-3xl" />
              <div className="relative bg-slate-900/80 backdrop-blur-sm rounded-3xl border border-white/10 p-8">
                <div className="flex items-center justify-center h-80">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                    className="relative w-64 h-64"
                  >
                    
                    {[0, 60, 120, 180, 240, 300].map((deg, i) => (
                      <motion.div
                        key={i}
                        className="absolute w-10 h-10 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 flex items-center justify-center"
                        style={{
                          top: '50%',
                          left: '50%',
                          transform: `rotate(${deg}deg) translateX(120px) translateY(-50%)`,
                        }}
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
                      >
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </motion.div>
                    ))}
                    
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 flex items-center justify-center">
                      <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    </div>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section data-mood="cta" className="relative py-32 overflow-hidden">
        
        <div className="absolute inset-0 w-full h-full">
          <SparklesCore
            id="ctaSparkles"
            background="transparent"
            minSize={0.4}
            maxSize={1.4}
            particleDensity={80}
            className="w-full h-full"
            particleColor="#a78bfa"
            speed={1}
          />
        </div>
        
        <div className="absolute inset-0 bg-linear-to-b from-transparent via-violet-600/[0.06] to-transparent pointer-events-none" />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={VIEWPORT}
          >
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
              {t("landing.cta.headingA")}
              <br />
              <span className="bg-linear-to-r from-violet-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
                {t("landing.cta.headingB")}
              </span>
            </h2>

            <div className="w-[20rem] md:w-[30rem] mx-auto h-10 relative mb-8">
              <div className="absolute inset-x-10 top-0 bg-linear-to-r from-transparent via-violet-500 to-transparent h-[2px] w-3/4 blur-sm" />
              <div className="absolute inset-x-10 top-0 bg-linear-to-r from-transparent via-violet-500 to-transparent h-px w-3/4" />
              <div className="absolute inset-x-20 top-0 bg-linear-to-r from-transparent via-cyan-500 to-transparent h-[5px] w-1/4 blur-sm" />
              <div className="absolute inset-x-20 top-0 bg-linear-to-r from-transparent via-cyan-500 to-transparent h-px w-1/4" />
            </div>

            <p className="text-xl text-slate-400 mb-10 max-w-2xl mx-auto">
              {t("landing.cta.intro")}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/contact"
                className="group relative inline-flex items-center justify-center"
              >
                <div className="absolute -inset-1 bg-linear-to-r from-violet-600 via-purple-600 to-cyan-600 rounded-xl blur-lg opacity-70 group-hover:opacity-100 transition duration-300" />
                <span className="relative flex items-center px-10 py-5 bg-linear-to-r from-violet-600 via-purple-600 to-cyan-600 rounded-xl text-lg font-semibold text-white">
                  {t("landing.nav.requestAccess")}
                  <svg className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </span>
              </Link>
              <Link
                to="/login"
                className="px-10 py-5 rounded-xl text-lg font-semibold text-white border border-white/20 hover:bg-white/5 transition-all duration-300"
              >
                {t("landing.nav.signIn")}
              </Link>
            </div>
            <p className="mt-6 text-sm text-slate-500">
              {t("landing.cta.footNote")}
            </p>
          </motion.div>
        </div>
      </section>

      <footer className="relative border-t border-white/5 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div className="md:col-span-2">
              <div className="relative inline-block mb-4">
                <div className="absolute -inset-2 bg-gradient-to-r from-violet-600 to-cyan-600 rounded-lg blur opacity-20" />
                <h3 className="relative text-2xl font-bold bg-gradient-to-r from-violet-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
                  DocLoq
                </h3>
              </div>
              <p className="text-slate-500 mb-6 max-w-sm">
                {t("landing.footer.tagline")}
              </p>
              <a
                href="https://wa.me/6289636458562"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 004.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0012.04 2zm5.8 14.16c-.25.69-1.44 1.32-1.98 1.36-.53.05-1.02.24-3.45-.72-2.9-1.14-4.76-4.1-4.9-4.29-.14-.19-1.18-1.57-1.18-2.99s.74-2.12 1.01-2.41c.26-.29.58-.36.77-.36.19 0 .39 0 .56.01.18.01.42-.07.66.5.25.59.84 2.04.91 2.19.07.14.12.31.02.5-.1.19-.14.31-.29.48-.14.17-.3.38-.43.51-.14.14-.29.29-.12.57.17.29.74 1.22 1.59 1.98 1.1.98 2.02 1.28 2.31 1.42.29.14.46.12.63-.07.17-.19.72-.84.91-1.13.19-.29.39-.24.66-.14.27.1 1.7.8 1.99.95.29.14.48.21.55.33.07.12.07.69-.18 1.38z" />
                </svg>
                {t("landing.footer.chatWhatsApp")} · +62 896-3645-8562
              </a>
            </div>

            <div>
              <h4 className="text-white font-semibold mb-4">{t("landing.footer.product")}</h4>
              <ul className="space-y-3">
                <li><a href="#features" onClick={(e) => handleAnchor(e, '#features')} className="text-slate-500 hover:text-white transition-colors text-sm">{t("landing.nav.features")}</a></li>
                <li><a href="#security" onClick={(e) => handleAnchor(e, '#security')} className="text-slate-500 hover:text-white transition-colors text-sm">{t("landing.nav.security")}</a></li>
                <li><a href="#how-it-works" onClick={(e) => handleAnchor(e, '#how-it-works')} className="text-slate-500 hover:text-white transition-colors text-sm">{t("landing.nav.howItWorks")}</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-semibold mb-4">{t("landing.footer.company")}</h4>
              <ul className="space-y-3">
                <li><Link to="/contact" className="text-slate-500 hover:text-white transition-colors text-sm">{t("landing.nav.contact")}</Link></li>
                <li><Link to="/login" className="text-slate-500 hover:text-white transition-colors text-sm">{t("landing.nav.signIn")}</Link></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-slate-600 text-sm">{t("landing.footer.copyright")}</p>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <Link to="/" className="text-slate-600 hover:text-white text-sm transition-colors">{t("landing.footer.home")}</Link>
              <Link to="/contact" className="text-slate-600 hover:text-white text-sm transition-colors">{t("landing.nav.contact")}</Link>
            </div>
          </div>
        </div>
      </footer>
      </div>
    </>
  );
}
