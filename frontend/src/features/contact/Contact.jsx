import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useLang } from '@/app/providers/LanguageProvider';
import CustomSelect from '@/components/ui/CustomSelect';

const WHATSAPP_NUMBER = '6289636458562'; // Josh, primary (and only) contact channel
const PHONE_DISPLAY = '+62 896-3645-8562';
const waLink = (text) => `https://wa.me/${WHATSAPP_NUMBER}${text ? `?text=${encodeURIComponent(text)}` : ''}`;

export default function Contact() {
  const { t } = useLang();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    company: '',
    phone: '',
    subject: '',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // No backend mailer, route the message straight to Josh's WhatsApp.
    const lines = [
      `Halo, saya ${formData.firstName} ${formData.lastName}`.trim(),
      formData.company && `Perusahaan: ${formData.company}`,
      formData.email && `Email: ${formData.email}`,
      formData.phone && `Telp: ${formData.phone}`,
      formData.subject && `Topik: ${formData.subject}`,
      '',
      formData.message,
    ].filter(Boolean);
    window.open(waLink(lines.join('\n')), '_blank', 'noopener,noreferrer');
    setIsSubmitted(true);
  };

  const contactInfo = [
    {
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 004.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0012.04 2zm5.8 14.16c-.25.69-1.44 1.32-1.98 1.36-.53.05-1.02.24-3.45-.72-2.9-1.14-4.76-4.1-4.9-4.29-.14-.19-1.18-1.57-1.18-2.99s.74-2.12 1.01-2.41c.26-.29.58-.36.77-.36.19 0 .39 0 .56.01.18.01.42-.07.66.5.25.59.84 2.04.91 2.19.07.14.12.31.02.5-.1.19-.14.31-.29.48-.14.17-.3.38-.43.51-.14.14-.29.29-.12.57.17.29.74 1.22 1.59 1.98 1.1.98 2.02 1.28 2.31 1.42.29.14.46.12.63-.07.17-.19.72-.84.91-1.13.19-.29.39-.24.66-.14.27.1 1.7.8 1.99.95.29.14.48.21.55.33.07.12.07.69-.18 1.38z" />
        </svg>
      ),
      title: t("contact.info.whatsappTitle"),
      detail: PHONE_DISPLAY,
      sub: t("contact.info.whatsappSub"),
      href: waLink('Halo, saya ingin bertanya tentang DocLoq.'),
    },
  ];

  const faqs = [
    {
      q: t("contact.faqs.access.q"),
      a: t("contact.faqs.access.a"),
    },
    {
      q: t("contact.faqs.reach.q"),
      a: `${t("contact.faqs.reach.aLead")} ${PHONE_DISPLAY} ${t("contact.faqs.reach.aTail")}`,
    },
    {
      q: t("contact.faqs.features.q"),
      a: t("contact.faqs.features.a"),
    },
    {
      q: t("contact.faqs.formats.q"),
      a: t("contact.faqs.formats.a"),
    },
  ];

  const [openFaq, setOpenFaq] = useState(null);

  return (
    <div className="min-h-screen bg-slate-950 text-white antialiased">
      {/* Background Effects */}
      <div className="fixed inset-0 z-0 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] rounded-full opacity-[0.07]"
          style={{ background: 'radial-gradient(ellipse, rgba(139, 92, 246, 0.6) 0%, transparent 70%)' }}
        />
        <div className="absolute bottom-0 left-1/4 w-[600px] h-[400px] rounded-full opacity-[0.05]"
          style={{ background: 'radial-gradient(ellipse, rgba(6, 182, 212, 0.6) 0%, transparent 70%)' }}
        />
        <div className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.1) 1px, transparent 1px)',
            backgroundSize: '80px 80px',
          }}
        />
      </div>

      {/* Navigation */}
      <nav className={`fixed w-full z-50 transition-all duration-500 ${scrolled ? 'py-0' : 'py-1'}`}>
        <div className={`absolute inset-0 transition-all duration-500 ${scrolled ? 'bg-slate-950/90 backdrop-blur-2xl border-b border-white/[0.06]' : 'bg-transparent'}`} />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 sm:h-18">
            <motion.div
              className="flex items-center"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Link to="/" className="relative group">
                <div className="absolute -inset-2 bg-gradient-to-r from-violet-600 to-cyan-600 rounded-lg blur opacity-0 group-hover:opacity-30 transition duration-500" />
                <h1 className="relative text-2xl font-bold bg-gradient-to-r from-violet-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
                  Docloq
                </h1>
              </Link>
            </motion.div>

            {/* Desktop Navigation */}
            <motion.div
              className="hidden md:flex items-center gap-1"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              {[
                { label: t("contact.nav.features"), to: '/#features' },
                { label: t("contact.nav.howItWorks"), to: '/#how-it-works' },
                { label: t("contact.nav.security"), to: '/#security' },
              ].map((item) => (
                <Link key={item.to} to={item.to} className="px-4 py-2 text-sm text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-all">
                  {item.label}
                </Link>
              ))}
              <span className="px-4 py-2 text-sm text-violet-400 font-medium rounded-lg bg-violet-500/10">{t("contact.nav.contact")}</span>
            </motion.div>

            <motion.div
              className="hidden md:flex items-center gap-3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Link
                to="/login"
                className="text-sm text-slate-300 hover:text-white px-5 py-2.5 rounded-xl font-medium transition-all hover:bg-white/5 border border-transparent hover:border-white/10"
              >
                {t("contact.nav.signIn")}
              </Link>
              <Link
                to="/login"
                className="relative group"
              >
                <div className="absolute -inset-0.5 bg-gradient-to-r from-violet-600 to-cyan-600 rounded-xl blur opacity-50 group-hover:opacity-80 transition duration-300" />
                <span className="relative flex items-center px-5 py-2.5 bg-slate-950 rounded-xl text-sm font-medium text-white group-hover:bg-slate-900 transition-colors">
                  {t("contact.nav.getStarted")}
                  <svg className="w-3.5 h-3.5 ml-2 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </span>
              </Link>
            </motion.div>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden text-white p-2 rounded-lg hover:bg-white/5 transition-colors"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="md:hidden bg-slate-950/95 backdrop-blur-2xl border-b border-white/[0.06]"
            >
              <div className="px-4 py-5 space-y-1">
                <Link to="/#features" className="block text-slate-300 hover:text-white py-2.5 px-3 rounded-lg hover:bg-white/5 transition-all text-sm">{t("contact.nav.features")}</Link>
                <Link to="/#how-it-works" className="block text-slate-300 hover:text-white py-2.5 px-3 rounded-lg hover:bg-white/5 transition-all text-sm">{t("contact.nav.howItWorks")}</Link>
                <Link to="/#security" className="block text-slate-300 hover:text-white py-2.5 px-3 rounded-lg hover:bg-white/5 transition-all text-sm">{t("contact.nav.security")}</Link>
                <span className="block text-violet-400 py-2.5 px-3 rounded-lg bg-violet-500/10 text-sm font-medium">{t("contact.nav.contact")}</span>
                <div className="pt-3 mt-2 border-t border-white/[0.06] space-y-2">
                  <Link to="/login" className="block text-center py-2.5 text-sm text-white border border-white/10 rounded-xl hover:bg-white/5 transition-all">{t("contact.nav.signIn")}</Link>
                  <Link to="/login" className="block text-center py-2.5 text-sm bg-gradient-to-r from-violet-600 to-cyan-600 text-white rounded-xl font-medium">{t("contact.nav.getStarted")}</Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-28 sm:pt-32 pb-8 sm:pb-12 px-4 sm:px-6 lg:px-8">
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 mb-6"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
            <span className="text-xs font-medium text-violet-400 tracking-wide uppercase">{t("contact.hero.badge")}</span>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-5 leading-tight tracking-tight"
          >
            <span className="text-white">{t("contact.hero.titleLead")}</span>
            <span className="bg-gradient-to-r from-violet-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
              {t("contact.hero.titleHighlight")}
            </span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed"
          >
            {t("contact.hero.subtitle")}
          </motion.p>
        </div>
      </section>

      {/* Contact Info Strip */}
      <section className="relative py-6 px-4 sm:px-6 lg:px-8">
        <div className="relative z-10 max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="grid grid-cols-1 gap-4 max-w-md mx-auto"
          >
            {contactInfo.map((info, index) => (
              <a
                key={index}
                href={info.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-4 p-5 rounded-2xl bg-slate-900/40 border border-white/[0.06] hover:border-emerald-500/30 hover:bg-slate-900/60 transition-all duration-300"
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/10 flex items-center justify-center text-emerald-400 group-hover:from-emerald-500/30 group-hover:to-cyan-500/30 transition-all">
                  {info.icon}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">{info.title}</p>
                  <p className="text-sm font-semibold text-white truncate">{info.detail}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{info.sub}</p>
                </div>
              </a>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Main Content: Form + Sidebar */}
      <section id="contact-form" className="relative py-12 sm:py-16 px-4 sm:px-6 lg:px-8">
        <div className="relative z-10 max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-5 gap-8 lg:gap-12">

            {/* Contact Form - 3 cols */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
              className="lg:col-span-3"
            >
              <div className="relative">
                <div className="absolute -inset-px bg-gradient-to-b from-violet-500/20 via-transparent to-cyan-500/20 rounded-2xl opacity-0 hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                <div className="relative bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-white/[0.06] p-6 sm:p-8">
                  <div className="mb-7">
                    <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">{t("contact.form.heading")}</h2>
                    <p className="text-sm text-slate-500">{t("contact.form.subheading")}</p>
                  </div>

                  {isSubmitted ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="py-16 text-center"
                    >
                      <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center mx-auto mb-5">
                        <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <h3 className="text-2xl font-bold text-white mb-2">{t("contact.success.title")}</h3>
                      <p className="text-slate-400 text-sm max-w-sm mx-auto">{t("contact.success.body")} {PHONE_DISPLAY}.</p>
                      <button
                        onClick={() => {
                          setIsSubmitted(false);
                          setFormData({ firstName: '', lastName: '', email: '', company: '', phone: '', subject: '', message: '' });
                        }}
                        className="mt-6 text-sm text-violet-400 hover:text-violet-300 font-medium transition-colors"
                      >
                        {t("contact.success.sendAnother")}
                      </button>
                    </motion.div>
                  ) : (
                    <form onSubmit={handleSubmit} className="space-y-5">
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">{t("contact.form.firstName")} *</label>
                          <input
                            type="text"
                            name="firstName"
                            value={formData.firstName}
                            onChange={handleChange}
                            required
                            className="w-full px-4 py-2.5 bg-slate-800/50 border border-white/[0.08] rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 focus:bg-slate-800/70 transition-all"
                            placeholder={t("contact.form.placeholders.firstName")}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">{t("contact.form.lastName")} *</label>
                          <input
                            type="text"
                            name="lastName"
                            value={formData.lastName}
                            onChange={handleChange}
                            required
                            className="w-full px-4 py-2.5 bg-slate-800/50 border border-white/[0.08] rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 focus:bg-slate-800/70 transition-all"
                            placeholder={t("contact.form.placeholders.lastName")}
                          />
                        </div>
                      </div>

                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">{t("common.email")} *</label>
                          <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            required
                            className="w-full px-4 py-2.5 bg-slate-800/50 border border-white/[0.08] rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 focus:bg-slate-800/70 transition-all"
                            placeholder={t("contact.form.placeholders.email")}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">{t("contact.form.phone")}</label>
                          <input
                            type="tel"
                            name="phone"
                            value={formData.phone}
                            onChange={handleChange}
                            className="w-full px-4 py-2.5 bg-slate-800/50 border border-white/[0.08] rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 focus:bg-slate-800/70 transition-all"
                            placeholder={t("contact.form.placeholders.phone")}
                          />
                        </div>
                      </div>

                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">{t("contact.form.company")}</label>
                          <input
                            type="text"
                            name="company"
                            value={formData.company}
                            onChange={handleChange}
                            className="w-full px-4 py-2.5 bg-slate-800/50 border border-white/[0.08] rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 focus:bg-slate-800/70 transition-all"
                            placeholder={t("contact.form.placeholders.company")}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">{t("contact.form.subject")} *</label>
                          <CustomSelect
                            variant="landing-violet"
                            name="subject"
                            value={formData.subject}
                            onChange={(val) => handleChange({ target: { name: "subject", value: val } })}
                            ariaLabel={t("contact.form.subject")}
                            placeholder={t("contact.form.selectTopic")}
                            options={[
                              { value: "account-request", label: t("contact.form.topics.accountRequest") },
                              { value: "sales", label: t("contact.form.topics.sales") },
                              { value: "support", label: t("contact.form.topics.support") },
                              { value: "partnership", label: t("contact.form.topics.partnership") },
                              { value: "enterprise", label: t("contact.form.topics.enterprise") },
                              { value: "demo", label: t("contact.form.topics.demo") },
                              { value: "other", label: t("contact.form.topics.other") },
                            ]}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">{t("contact.form.message")} *</label>
                        <textarea
                          name="message"
                          value={formData.message}
                          onChange={handleChange}
                          required
                          rows={4}
                          className="w-full px-4 py-2.5 bg-slate-800/50 border border-white/[0.08] rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 focus:bg-slate-800/70 transition-all resize-none"
                          placeholder={t("contact.form.placeholders.message")}
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="group relative w-full mt-2"
                      >
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-violet-600 to-cyan-600 rounded-xl blur opacity-40 group-hover:opacity-70 transition duration-300" />
                        <span className="relative flex items-center justify-center w-full px-6 py-3 bg-gradient-to-r from-violet-600 via-purple-600 to-cyan-600 rounded-xl text-sm font-semibold text-white transition-all">
                          {isSubmitting ? (
                            <>
                              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              {t("contact.form.sending")}
                            </>
                          ) : (
                            <>
                              {t("contact.form.submit")}
                              <svg className="w-4 h-4 ml-2 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                              </svg>
                            </>
                          )}
                        </span>
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Sidebar - 2 cols */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              viewport={{ once: true }}
              className="lg:col-span-2 space-y-6"
            >
              {/* Request Access CTA */}
              <div className="relative overflow-hidden rounded-2xl">
                <div className="absolute inset-0 bg-gradient-to-br from-violet-600/20 to-cyan-600/20" />
                <div className="absolute inset-0 bg-slate-900/80" />
                <div className="relative p-6 border border-violet-500/15 rounded-2xl">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-white">{t("contact.access.title")}</h3>
                  </div>
                  <p className="text-sm text-slate-400 leading-relaxed mb-5">
                    {t("contact.access.body")}
                  </p>
                  <div className="space-y-2.5 mb-5">
                    {[t("contact.access.benefits.verified"), t("contact.access.benefits.security"), t("contact.access.benefits.onboarding")].map((item, i) => (
                      <div key={i} className="flex items-center gap-2.5">
                        <div className="w-5 h-5 rounded-md bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                          <svg className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <span className="text-xs text-slate-300">{item}</span>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => {
                      setFormData(prev => ({ ...prev, subject: 'account-request' }));
                      document.getElementById('contact-form')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="w-full py-2.5 text-sm font-medium text-white bg-gradient-to-r from-violet-600 to-cyan-600 rounded-xl hover:from-violet-500 hover:to-cyan-500 transition-all"
                  >
                    {t("contact.access.cta")}
                  </button>
                </div>
              </div>

              {/* Direct WhatsApp */}
              <a
                href={waLink('Halo, saya ingin bertanya tentang DocLoq.')}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-4 p-6 rounded-2xl bg-slate-900/40 border border-white/[0.06] hover:border-emerald-500/30 hover:bg-slate-900/60 transition-all"
              >
                <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 004.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0012.04 2zm5.8 14.16c-.25.69-1.44 1.32-1.98 1.36-.53.05-1.02.24-3.45-.72-2.9-1.14-4.76-4.1-4.9-4.29-.14-.19-1.18-1.57-1.18-2.99s.74-2.12 1.01-2.41c.26-.29.58-.36.77-.36.19 0 .39 0 .56.01.18.01.42-.07.66.5.25.59.84 2.04.91 2.19.07.14.12.31.02.5-.1.19-.14.31-.29.48-.14.17-.3.38-.43.51-.14.14-.29.29-.12.57.17.29.74 1.22 1.59 1.98 1.1.98 2.02 1.28 2.31 1.42.29.14.46.12.63-.07.17-.19.72-.84.91-1.13.19-.29.39-.24.66-.14.27.1 1.7.8 1.99.95.29.14.48.21.55.33.07.12.07.69-.18 1.38z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">{t("contact.whatsappCard.title")}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{PHONE_DISPLAY}, Josh</p>
                </div>
              </a>
            </motion.div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="relative py-12 sm:py-16 px-4 sm:px-6 lg:px-8">
        <div className="relative z-10 max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">{t("contact.faqSection.heading")}</h2>
            <p className="text-sm text-slate-400">{t("contact.faqSection.subheading")}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            viewport={{ once: true }}
            className="space-y-3"
          >
            {faqs.map((faq, index) => (
              <div
                key={index}
                className="group rounded-xl border border-white/[0.06] bg-slate-900/30 hover:bg-slate-900/50 transition-all overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left"
                >
                  <span className="text-sm font-medium text-white pr-4">{faq.q}</span>
                  <svg
                    className={`w-4 h-4 text-slate-500 flex-shrink-0 transition-transform duration-300 ${openFaq === index ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <AnimatePresence>
                  {openFaq === index && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="px-5 pb-4">
                        <p className="text-sm text-slate-400 leading-relaxed">{faq.a}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="relative py-12 sm:py-16 px-4 sm:px-6 lg:px-8">
        <div className="relative z-10 max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className="relative rounded-2xl overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-violet-600/10 via-purple-600/10 to-cyan-600/10" />
            <div className="absolute inset-0 bg-slate-900/50" />
            <div className="relative px-6 sm:px-10 py-10 sm:py-12 text-center border border-white/[0.06] rounded-2xl">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-violet-500/15 border border-violet-500/20 mb-5">
                <svg className="w-6 h-6 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-white mb-3">{t("contact.ctaBanner.title")}</h3>
              <p className="text-sm text-slate-400 max-w-xl mx-auto leading-relaxed mb-6">
                {t("contact.ctaBanner.body")}
              </p>
              <a
                href={waLink('Halo, saya ingin bertanya tentang DocLoq.')}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-all"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 004.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0012.04 2zm5.8 14.16c-.25.69-1.44 1.32-1.98 1.36-.53.05-1.02.24-3.45-.72-2.9-1.14-4.76-4.1-4.9-4.29-.14-.19-1.18-1.57-1.18-2.99s.74-2.12 1.01-2.41c.26-.29.58-.36.77-.36.19 0 .39 0 .56.01.18.01.42-.07.66.5.25.59.84 2.04.91 2.19.07.14.12.31.02.5-.1.19-.14.31-.29.48-.14.17-.3.38-.43.51-.14.14-.29.29-.12.57.17.29.74 1.22 1.59 1.98 1.1.98 2.02 1.28 2.31 1.42.29.14.46.12.63-.07.17-.19.72-.84.91-1.13.19-.29.39-.24.66-.14.27.1 1.7.8 1.99.95.29.14.48.21.55.33.07.12.07.69-.18 1.38z" />
                </svg>
                {PHONE_DISPLAY}
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative border-t border-white/[0.04] py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <Link to="/" className="text-lg font-bold bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
                Docloq
              </Link>
              <span className="text-slate-800">|</span>
              <span className="text-slate-600 text-xs">&copy; 2026 DocLoq</span>
            </div>
            <div className="flex items-center gap-6">
              <Link to="/" className="text-slate-600 hover:text-slate-300 text-xs transition-colors">{t("contact.footer.home")}</Link>
              <a href={waLink('Halo, saya ingin bertanya tentang DocLoq.')} target="_blank" rel="noopener noreferrer" className="text-slate-600 hover:text-slate-300 text-xs transition-colors">{t("contact.nav.contact")}</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
