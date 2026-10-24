import { X, GraduationCap, ExternalLink } from 'lucide-react';

// Microsoft AZ-900 (Azure Fundamentals) Study and Practice Guide - the one
// in-app guide that replaced six separate AZ-900 cards in Resources (study
// guide, learning paths, exam prep checklist, hands-on practice, official labs
// and guided projects). The Resources card keeps a checklist of the same
// steps for progress; this is the full plan with every link. Every link was
// checked against Microsoft's own pages. Microsoft retired its free Learn
// sandboxes, so every hands-on step needs an Azure subscription (the free
// 30-day trial counts).
const LEARN = 'https://learn.microsoft.com/en-us/training';
const LABS = 'https://microsoftlearning.github.io/AZ-900-Microsoft-Azure-Fundamentals/Instructions/Labs';
const SECTIONS = [
  {
    heading: 'Overview',
    body: "An entry-level credential that validates core knowledge of cloud computing and Azure services, including security principles - a stepping stone for careers in cybersecurity and cloud infrastructure. Price: around R700. Recommended study duration: 1 to 4 weeks. A score of 700 or more passes.",
    items: [{ label: 'Official AZ-900 Certification', href: 'https://learn.microsoft.com/en-us/credentials/certifications/azure-fundamentals/' }],
  },
  {
    heading: '1. Learn: Microsoft Learn paths',
    body: "Microsoft's own free, self-paced training. The first three paths map onto the three exam domains, so work through them in order; each is a few hours.",
    items: [
      { label: 'Part 1: Describe cloud concepts (25-30% of the exam)', href: `${LEARN}/paths/microsoft-azure-fundamentals-describe-cloud-concepts/` },
      { label: 'Part 2: Describe Azure architecture and services (35-40%)', href: `${LEARN}/paths/azure-fundamentals-describe-azure-architecture-services/` },
      { label: 'Part 3: Describe Azure management and governance (30-35%)', href: `${LEARN}/paths/describe-azure-management-governance/` },
      { label: 'Part 4: Apply Azure skills in guided projects (hands-on)', href: `${LEARN}/paths/introduction-cloud-infrastructure-apply-azure-skills-guided-projects/` },
    ],
  },
  {
    heading: '2. Practice: your own Azure account',
    body: "Reading about Azure only goes so far. Build a few small things so the exam's services and terms mean something. Create a free Azure account, set a budget alert in Cost Management before anything else, and delete what you create when you are done.",
    items: [{ label: 'Create a free Azure account', href: 'https://azure.microsoft.com/pricing/purchase-options/azure-account' }],
    list: [
      'Create a resource group and add a tag to it',
      'Create a storage account and upload a file',
      'Deploy a small virtual machine, then look at its networking',
      'Open Azure Monitor and Advisor and see what they report',
      'Delete the resource group to clean everything up',
    ],
  },
  {
    heading: '3. Practice: Microsoft official labs',
    body: 'Five exercises Microsoft publishes for AZ-900, 15 to 20 minutes each.',
    items: [
      { label: 'Create an Azure resource (15 min)', href: `${LABS}/02-exercise-create-azure-resource.html` },
      { label: 'Create a virtual machine and configure it as a web host (20 min)', href: `${LABS}/03-exercise-create-azure-virtual-machine.html` },
      { label: 'Create a storage blob and share a file (15 min)', href: `${LABS}/05-exercise-create-storage-blob.html` },
      { label: 'Estimate workload costs with the Pricing calculator (15 min)', href: `${LABS}/06-exercise-estimate-workload-costs-use-pricing-calculator.html` },
      { label: 'Configure resource locks (15 min)', href: `${LABS}/08-exercise-configure-resource-lock.html` },
    ],
  },
  {
    heading: '4. Practice: guided projects',
    body: 'Eight end-to-end projects from Microsoft Learn. Pick as many as you like; they are the closest thing to portfolio-style practice for the exam topics.',
    items: [
      { label: 'Deploy a static website with Azure Blob Storage', href: `${LEARN}/modules/guided-project-deploy-static-website-blob-storage/` },
      { label: 'Organize and protect resources with tags and locks', href: `${LEARN}/modules/guided-project-organize-resources-tags-locks/` },
      { label: 'Build a simple website endpoint with Azure Functions', href: `${LEARN}/modules/guided-project-build-basic-website-endpoint-with-functions/` },
      { label: 'Set up new employee access (Entra ID and RBAC)', href: `${LEARN}/modules/guided-project-new-employee-access/` },
      { label: 'Share files securely (SAS tokens and access policies)', href: `${LEARN}/modules/guided-project-share-files-securely/` },
      { label: 'Set up cost guardrails in Azure', href: `${LEARN}/modules/guided-project-cost-guardrails/` },
      { label: 'Monitor Azure with Service Health and Activity Log alerts', href: `${LEARN}/modules/guided-project-monitor-service-health-activity-alerts/` },
      { label: 'Manage Azure resources with Cloud Shell and the Azure CLI', href: `${LEARN}/modules/guided-project-manage-resources-cloud-shell-cli/` },
    ],
  },
  {
    heading: '5. Practice: KodeKloud 100 Days of Cloud (free)',
    body: "KodeKloud's free 100 Days of Cloud is a daily, hands-on way to keep practising cloud skills in a real environment, which is the habit that makes the exam topics stick. It is free to use.",
    items: [{ label: 'KodeKloud 100 Days of Cloud', href: 'https://engineer.kodekloud.com/practice' }],
  },
  {
    heading: '6. Get exam-ready',
    body: "Read what is actually measured, watch the videos, then test yourself with the free Practice Assessment. Revisit the learning-path modules for any weak domain and retake it until you are comfortably above 70%, then try the exam sandbox so the exam screen is familiar before you book.",
    items: [
      { label: 'Official study guide and skills-measured outline', href: 'https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/az-900' },
      { label: 'Exam Readiness Zone videos', href: 'https://learn.microsoft.com/en-us/shows/exam-readiness-zone/' },
      { label: 'Recommended AZ-900 video playlist (YouTube)', href: 'https://www.youtube.com/playlist?list=PLZCHR_fccEf8zN6UB8JOK2Y6l5DVqAcyc' },
      { label: 'Free Practice Assessment', href: 'https://learn.microsoft.com/en-us/credentials/certifications/exams/az-900/practice/assessment?assessment-type=practice&assessmentId=23' },
      { label: 'Exam sandbox', href: 'https://aka.ms/examdemo' },
    ],
  },
];

export default function AZ900GuideModal({ onClose }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'var(--modal-backdrop)',
        backdropFilter: 'blur(8px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        className="glass-card"
        style={{
          width: '100%',
          maxWidth: '620px',
          maxHeight: '85vh',
          overflowY: 'auto',
          padding: '32px',
          border: '1px solid var(--accent-cyan)',
          boxShadow: '0 0 30px rgba(var(--accent-rgb), 0.2)',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-secondary)',
            borderRadius: '50%',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <X size={18} />
        </button>

        <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <GraduationCap size={22} color="var(--accent-cyan)" />
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff' }}>AZ-900 Study and Practice Guide</h2>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '24px' }}>
          Learn it, practise it, then test yourself. Tick the steps off on the Resources card as you go.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {SECTIONS.map((s) => (
            <div key={s.heading} style={{ paddingBottom: '16px', borderBottom: '1px solid var(--border-color)' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '6px' }}>{s.heading}</h4>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>{s.body}</p>
              {s.list && (
                <ul style={{ margin: '10px 0 0', paddingLeft: '18px', fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  {s.list.map((t) => <li key={t}>{t}</li>)}
                </ul>
              )}
              {s.items && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }}>
                  {s.items.map((it) => (
                    <a
                      key={it.href}
                      href={it.href}
                      target="_blank"
                      rel="noreferrer"
                      style={{ display: 'inline-flex', alignItems: 'flex-start', gap: '6px', fontSize: '0.85rem', color: 'var(--accent-cyan)', fontWeight: 600, textDecoration: 'none' }}
                    >
                      <ExternalLink size={14} style={{ flexShrink: 0, marginTop: '3px' }} /> <span>{it.label}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
          <button className="btn btn-primary" onClick={onClose}>Got It</button>
        </div>
      </div>
    </div>
  );
}
