import React from 'react';
import { X, Award, DollarSign, BookOpen, ShieldCheck, Clock, FileText, ExternalLink } from 'lucide-react';

const CERT_KNOWLEDGE_BASE = {
  oscp: {
    title: 'OSCP — Offensive Security Certified Professional',
    provider: 'OffSec (Offensive Security)',
    price: '$1,649 USD (~R 30,000 ZAR)',
    format: '24-Hour Hands-on Exam + 24-Hour Report Writing',
    difficulty: 'Advanced Hands-on Penetration Testing',
    description:
      'The gold standard in ethical hacking and penetration testing certifications. Candidates must demonstrate practical mastery in identifying, exploiting, and escalating privileges across vulnerable target machines in a strict lab environment.',
    domains: [
      'Active Directory Attacks & Kerberoasting',
      'Web Application Exploitation (SQLi, XSS, LFI/RFI)',
      'Windows & Linux Privilege Escalation',
      'Buffer Overflows & Manual Exploit Modification',
      'Client-Side Attacks & Tunneling/Port Forwarding',
    ],
    prerequisites: 'Solid networking foundations, Python/Bash scripting, Linux & Command Line fluency.',
  },
  securityplus: {
    title: 'CompTIA Security+ (SY0-701)',
    provider: 'CompTIA',
    price: '$392 USD (~R 7,100 ZAR — Discounted for HH Members)',
    format: '90 Multiple Choice & Performance-Based Questions (90 Minutes)',
    difficulty: 'Core Foundational Security Baseline',
    description:
      'Global baseline certification validating foundational cybersecurity knowledge. Covers core principles of risk management, threat mitigation, network security architecture, and incident response operations.',
    domains: [
      'General Security Concepts & Cryptography',
      'Threats, Vulnerabilities, and Mitigations',
      'Security Architecture & Infrastructure Design',
      'Security Operations & Incident Response Protocols',
      'Governance, Risk Management, and Compliance (GRC)',
    ],
    prerequisites: 'CompTIA Network+ or 2 years IT administration experience recommended.',
  },
  ecppt: {
    title: 'eCPPT — eLearnSecurity Certified Professional Penetration Tester',
    provider: 'INE Security (formerly eLearnSecurity)',
    price: '$400 USD (~R 7,300 ZAR)',
    format: '7-Day Practical Exam + 7-Day Professional Report Writing',
    difficulty: 'Intermediate Practical Pentesters',
    description:
      'A deeply respected practical penetration testing exam requiring candidates to execute a full-scale corporate network penetration test, pivot across subnets, and deliver an executive-ready report.',
    domains: [
      'Network Security & DMZ Penetration Testing',
      'Web Application Security & Vulnerability Scanning',
      'System Security & Memory Corruption',
      'Wi-Fi Security & Wireless Auditing',
      'Pivoting, Routing & Multi-Subnet Tunneling',
    ],
    prerequisites: 'Understanding of TCP/IP, basic C/C++ memory structure, web server administration.',
  },
  az500: {
    title: 'Microsoft Azure Security Technologies (AZ-500)',
    provider: 'Microsoft',
    price: '$165 USD (~R 3,000 ZAR — Covered for HH Milestone Achievers)',
    format: '40–60 Questions & Performance Labs (120 Minutes)',
    difficulty: 'Intermediate Cloud Security',
    description:
      'Validates cloud security engineers implementing security controls, maintaining cloud posture, managing identity and access, and protecting data, applications, and networks in Microsoft Azure environments.',
    domains: [
      'Manage Microsoft Entra ID (Azure AD) Identities & Access',
      'Implement Azure Secure Network & Compute Infrastructure',
      'Protect Data at Rest, in Transit, and in Storage',
      'Manage Azure Security Posture & Microsoft Defender for Cloud',
    ],
    prerequisites: 'Familiarity with Azure Cloud, PowerShell/CLI, and cloud networking principles.',
  },
  networkplus: {
    title: 'CompTIA Network+ (N10-008)',
    provider: 'CompTIA',
    price: '$358 USD (~R 6,500 ZAR)',
    format: '90 Performance-Based & Multiple Choice Questions (90 Minutes)',
    difficulty: 'Foundational Networking Baseline',
    description:
      'Establishes a career in core network infrastructure. Validates skills to design, implement, troubleshoot, and secure essential wired and wireless networks.',
    domains: [
      'Networking Fundamentals & OSI/TCP-IP Models',
      'Network Implementations & Routing Protocols',
      'Network Operations & High Availability',
      'Network Security Concepts & Firewall Policies',
      'Network Troubleshooting & Diagnostic Tools',
    ],
    prerequisites: 'Basic computer literacy or CompTIA A+ certification.',
  },
};

export default function CertDetailsModal({ certName, memberName, cohort, date, onClose }) {
  if (!certName) return null;

  // Determine lookup key based on cert name string
  const cleanName = certName.toLowerCase();
  let certData = null;

  if (cleanName.includes('oscp')) {
    certData = CERT_KNOWLEDGE_BASE.oscp;
  } else if (cleanName.includes('security') || cleanName.includes('sec+')) {
    certData = CERT_KNOWLEDGE_BASE.securityplus;
  } else if (cleanName.includes('ecppt')) {
    certData = CERT_KNOWLEDGE_BASE.ecppt;
  } else if (cleanName.includes('azure') || cleanName.includes('az-500')) {
    certData = CERT_KNOWLEDGE_BASE.az500;
  } else if (cleanName.includes('network') || cleanName.includes('net+')) {
    certData = CERT_KNOWLEDGE_BASE.networkplus;
  } else {
    // Custom Fallback
    certData = {
      title: certName,
      provider: 'Recognized Security Issuer',
      price: 'Varies by Certification Authority',
      format: 'Formal Knowledge Assessment / Practical Exam',
      difficulty: 'Intermediate Technical Level',
      description: `A targeted cybersecurity credential pursued by ${memberName || 'Hacking Hub operatives'} to validate specialized technical expertise.`,
      domains: [
        'Core Technical Fundamentals & Architecture',
        'Threat Analysis & Risk Mitigation',
        'Hands-on Lab Verification & Practical Drills',
      ],
      prerequisites: 'Foundational cybersecurity knowledge & active study.',
    };
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(3, 7, 18, 0.85)',
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
          maxWidth: '680px',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '32px',
          border: '1px solid var(--accent-cyan)',
          boxShadow: '0 0 30px rgba(94, 227, 122, 0.2)',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
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
            transition: 'all 0.2s ease',
          }}
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
            <span className="badge badge-warning">{cohort || 'HH CERTIFICATION'}</span>
            <span className="badge badge-success">{certData.provider}</span>
          </div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 700, color: '#fff', lineHeight: 1.3 }}>
            {certData.title}
          </h2>
          {memberName && (
            <p style={{ color: 'var(--accent-cyan)', fontSize: '0.9rem', marginTop: '6px', fontWeight: 600 }}>
              Operative Target: {memberName} {date ? `(Target Exam: ${date})` : ''}
            </p>
          )}
        </div>

        {/* Description */}
        <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: 1.6 }}>
          {certData.description}
        </p>

        {/* Key Parameters Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '16px',
            marginBottom: '24px',
            background: 'rgba(255, 255, 255, 0.02)',
            padding: '16px',
            borderRadius: 'var(--border-radius-md)',
            border: '1px solid var(--border-color)',
          }}
        >
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
              Exam Fee / Price
            </div>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--success)' }}>
              {certData.price}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
              Format & Duration
            </div>
            <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
              {certData.format}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
              Difficulty Level
            </div>
            <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--accent-purple)' }}>
              {certData.difficulty}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
              Prerequisites
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {certData.prerequisites}
            </div>
          </div>
        </div>

        {/* Covered Domains List */}
        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '12px', color: '#fff' }}>
            Covered Exam Domains & Skillsets:
          </h4>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {certData.domains.map((domain, idx) => (
              <li
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontSize: '0.88rem',
                  padding: '8px 12px',
                  borderRadius: 'var(--border-radius-sm)',
                  background: 'rgba(94, 227, 122, 0.04)',
                  border: '1px solid rgba(94, 227, 122, 0.1)',
                }}
              >
                <ShieldCheck size={16} color="var(--accent-cyan)" style={{ flexShrink: 0 }} />
                <span>{domain}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
          <button className="btn btn-secondary" onClick={onClose}>
            Close Breakdown
          </button>
        </div>
      </div>
    </div>
  );
}
