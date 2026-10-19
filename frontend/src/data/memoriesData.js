/**
 * Mock Data — Memories Page
 *
 * Frontend-only mock data for the Memories page of The Manager's Chef.
 * This does NOT connect to any backend. Replace with API calls when ready.
 *
 * Each memory has:
 *   id, title, summary, fullSummary, category, date, source,
 *   client, project, people, relatedMeeting, relatedTask, relatedDecision,
 *   keyDecisions, context, pinned, sortTimestamp
 */

export const mockMemoriesData = [
  {
    id: "mem-page-1",
    title: "Client X — Delivery Deadline",
    summary:
      "During the Sept 12 meeting, Client X requested the feature delivery before Friday to allow their QA lead a 48h acceptance window before production cutover.",
    fullSummary:
      "During the Sept 12 sync with Client X legal rep and Elena Rostova, the client formally requested that all major release candidates be frozen by Wednesday. This gives their QA lead Sarah Vance a full 48-hour acceptance window before the Friday production cutover. Elena agreed and the constraint was added to Clause 4.2 of the draft contract. This is a binding commitment that affects sprint planning for the entire Client X SLA track.",
    category: "Commitment",
    date: "Sep 12, 2026",
    source: "Meeting Transcript",
    client: "Client X",
    project: "Client X SLA",
    people: ["Sarah Vance (Client Lead)", "Elena Rostova (Tech Lead)", "Alex Morgan (EM)"],
    relatedMeeting: "Client X Contract & Buffer Sync",
    relatedTask: "Client X SLA Delivery Verification",
    relatedDecision: "Feature deadline moved to Friday (48h buffer required)",
    keyDecisions: [
      "All release candidates frozen on Wednesdays for Client X staging deployments.",
      "Added Clause 4.2 Data Retention requirement to draft contract.",
      "QA acceptance window is strictly 48 hours, non-negotiable.",
    ],
    context:
      "Client X previously expressed hesitation about Friday deployments without weekend on-call coverage. This commitment was made to de-risk the rollout and ensure their QA team has adequate time.",
    pinned: true,
    sortTimestamp: 1726099200000,
  },
  {
    id: "mem-page-2",
    title: "Q4 Staffing & Hiring Order",
    summary:
      "Agreed with VP of Engineering to prioritize 1 Senior Distributed Systems Engineer before reopening any junior positions for Q4.",
    fullSummary:
      "During the 1:1 with VP of Engineering on Sept 10, it was mutually agreed that the Q4 hiring roadmap will prioritize one Senior Distributed Systems Engineer. Junior engineering positions will remain paused until this hire is closed. This decision was driven by the immediate capacity gap on the ContextItem indexing migration and the growing on-call load on the existing distributed systems team.",
    category: "Decision",
    date: "Sep 10, 2026",
    source: "1:1 with VP Eng",
    client: null,
    project: "Engineering Team",
    people: ["VP of Engineering", "Alex Morgan (EM)"],
    relatedMeeting: "Product Strategy & Roadmap Sync",
    relatedTask: null,
    relatedDecision: "Junior positions paused until senior distributed systems hire is complete",
    keyDecisions: [
      "Senior Distributed Systems Engineer is Q4 hiring priority #1.",
      "All junior engineering requisitions paused until senior hire closes.",
      "David Kim will own the technical interview loop.",
    ],
    context:
      "The decision was driven by mounting on-call pressure and the complexity of the Q4 ContextItem migration. Adding a junior engineer now would increase management overhead without providing net capacity.",
    pinned: false,
    sortTimestamp: 1725926400000,
  },
  {
    id: "mem-page-3",
    title: "Security & HMAC Ingestion Protocol",
    summary:
      "All incoming third-party webhooks must validate SHA-256 HMAC headers prior to queuing in Redis. This is a mandatory security policy, not a suggestion.",
    fullSummary:
      "Established during the Security Review on Sept 8. All webhook ingestion endpoints must perform SHA-256 HMAC signature validation before any payload is accepted into the Redis queue. This applies to all third-party integrations including calendar providers, CRMs, and external monitoring systems. Payloads that fail validation must be rejected with a 401 and logged to the security event stream. This policy was approved by the CISO and the VP of Engineering.",
    category: "Policy",
    date: "Sep 8, 2026",
    source: "Security Review",
    client: null,
    project: "Security & Compliance",
    people: ["CISO", "VP of Engineering", "Alex Morgan (EM)"],
    relatedMeeting: null,
    relatedTask: "Security & HMAC Webhook Validation Audit",
    relatedDecision: "HMAC validation mandatory for all webhook ingestion paths",
    keyDecisions: [
      "SHA-256 HMAC validation required on all third-party webhook endpoints.",
      "Invalid payloads must return 401 and be logged to the security event stream.",
      "Policy approved by CISO and VP Engineering.",
    ],
    context:
      "This policy was triggered by a near-miss incident where a forged webhook payload attempted to inject data into the staging Redis queue. The security team identified the gap during a routine penetration test.",
    pinned: false,
    sortTimestamp: 1725753600000,
  },
  {
    id: "mem-page-4",
    title: "On-call Escalation Rule for P1 Incidents",
    summary:
      "If a P1 incident is unacknowledged within 7 minutes, page the secondary lead and notify #incident-leads immediately. Adopted after August post-mortem.",
    fullSummary:
      "Following the August 28 connection pool exhaustion incident — which went unacknowledged for 14 minutes due to misconfigured PagerDuty escalation — the SRE team and engineering leadership adopted a strict 7-minute escalation rule for all severity 1 incidents. If a P1 page is unacknowledged within 7 minutes, PagerDuty automatically escalates to the secondary on-call lead and sends a notification to the #incident-leads Slack channel.",
    category: "Operations",
    date: "Aug 29, 2026",
    source: "Incident Post-Mortem",
    client: null,
    project: "DevOps & SRE",
    people: ["On-call Leads", "SRE Team", "Alex Morgan (EM)"],
    relatedMeeting: "P1 Incident Post-Mortem & On-call Routing",
    relatedTask: "Review On-call Escalation Rule for P1s in PagerDuty",
    relatedDecision: "7-minute secondary escalation rule adopted across all P1 pages",
    keyDecisions: [
      "Strict 7-minute secondary escalation for all severity 1 pages.",
      "Circuit breaker added around third-party webhook ingestion queue.",
      "Quarterly incident drills scheduled with distributed leads.",
    ],
    context:
      "Root cause of the Aug 28 incident was a connection leak in stale background worker threads during Redis reconnection storms. The alert was delayed by 14 minutes due to a misconfigured escalation policy, leading to extended customer-facing downtime.",
    pinned: false,
    sortTimestamp: 1724889600000,
  },
  {
    id: "mem-page-5",
    title: "ContextItem Denormalized Indexing Architecture",
    summary:
      "Architecture team approved keeping ContextItem as a denormalized search index while PostgreSQL domain tables remain the single source of truth.",
    fullSummary:
      "After a detailed spike comparing Postgres JSONB indexing vs. an external Elasticsearch cluster, the architecture team reached consensus: ContextItem will remain a denormalized search index, with all domain entities (Meetings, Tasks, Decisions) as the authoritative data sources in PostgreSQL. Redis streams will handle cache invalidation events. CDC (change data capture) listeners will be implemented by Marcus Thorne rather than synchronous write-through hooks. This decision was documented in ADR-104.",
    category: "Decision",
    date: "Sep 27, 2026",
    source: "Architecture Review",
    client: null,
    project: "Core Architecture",
    people: ["Staff Architect", "Marcus Thorne (Backend)", "David Kim (Lead Architect)", "Alex Morgan (EM)"],
    relatedMeeting: "Q4 Architecture Review: ContextItem Indexing",
    relatedTask: "ContextItem Denormalized Indexing RFC Sign-off",
    relatedDecision: "ContextItem stays as pure search index, PostgreSQL is source of truth",
    keyDecisions: [
      "ContextItem kept purely as a denormalized search index.",
      "Primary domain entities remain source of truth in PostgreSQL.",
      "Redis stream used for cache invalidation events.",
      "CDC listeners preferred over synchronous write-through hooks.",
      "ADR-104 published to engineering repository.",
    ],
    context:
      "Postgres JSONB indexing provided 3x lower latency compared to secondary external Elasticsearch cluster in the spike. The simpler architecture reduces operational overhead and eliminates the need to maintain an external search cluster.",
    pinned: true,
    sortTimestamp: 1727395200000,
  },
  {
    id: "mem-page-6",
    title: "Sprint Q4 Migration Timeline Sign-off",
    summary:
      "The Q4 API schema migration must be completed before the Oct 15 cutover window. Two open questions remain on backward compatibility and API schema sign-off.",
    fullSummary:
      "During the Sprint Alignment meeting on Sept 28, Elena flagged two unresolved questions regarding the Q4 migration: (1) backward compatibility for the legacy API schema during the transition period, and (2) formal API sign-off from the product team. Both items must be resolved before the Oct 15 cutover window. Marcus Thorne agreed to prepare a backward compatibility matrix by Oct 3.",
    category: "Meeting",
    date: "Sep 28, 2026",
    source: "Meeting Transcript",
    client: null,
    project: "Sprint Planning",
    people: ["Elena Rostova (Tech Lead)", "Marcus Thorne (Backend)", "David Kim (Lead Architect)", "Alex Morgan (EM)"],
    relatedMeeting: "Sprint Alignment with Tech Leads",
    relatedTask: "Approve Cloud Budget Reallocation",
    relatedDecision: null,
    keyDecisions: [],
    context:
      "Two unresolved questions were flagged in the Sept 28 sprint alignment: API backward compatibility during transition and product team sign-off. Oct 15 is a hard cutover deadline agreed with the infrastructure team.",
    pinned: false,
    sortTimestamp: 1727481600000,
  },
  {
    id: "mem-page-7",
    title: "Legal — Clause 4.2 Data Retention Update",
    summary:
      "External counsel requested updates to Clause 4.2 of the Client X contract to include explicit data retention policy and deletion timelines.",
    fullSummary:
      "During the Client X Contract & Buffer Sync on Sept 12, external counsel flagged that Clause 4.2 of the current contract does not specify data retention timelines or deletion SLAs. The updated clause must include: (1) maximum 90-day data retention unless otherwise agreed in writing, (2) automated deletion workflows on contract expiry, and (3) audit trail requirements for all data access events. The revised clause must be submitted to internal legal by today.",
    category: "Client",
    date: "Sep 12, 2026",
    source: "Contract Review",
    client: "Client X",
    project: "Legal & Compliance",
    people: ["External Counsel", "Elena Rostova", "Alex Morgan (EM)"],
    relatedMeeting: "Client X Contract & Buffer Sync",
    relatedTask: "Send revised contract clause to Legal",
    relatedDecision: "Clause 4.2 must include 90-day data retention cap and automated deletion",
    keyDecisions: [
      "Maximum 90-day data retention unless written exception agreed.",
      "Automated deletion workflow required on contract expiry.",
      "Full audit trail for all data access events.",
    ],
    context:
      "External counsel noticed a gap during contract review — the current SLA agreement does not satisfy GDPR Article 17 (Right to Erasure) requirements. This is a legal compliance risk that must be closed before contract signature.",
    pinned: false,
    sortTimestamp: 1726099200000,
  },
  {
    id: "mem-page-8",
    title: "David Kim — Career Development Goals",
    summary:
      "David wants to progress toward a Staff Engineer title by end of Q1. Key focus areas: distributed systems architecture ownership and leading the junior mentorship program.",
    fullSummary:
      "In the most recent 1:1 on Sept 14, David Kim outlined his goal of achieving Staff Engineer level by end of Q1 2027. To support this, he wants to: (1) take full technical ownership of the distributed systems architecture decisions, (2) lead the junior engineer mentorship program starting Q4, and (3) present at the internal engineering all-hands before year end. David also flagged that the current on-call load on weekends is impacting his capacity for deep technical work.",
    category: "Meeting",
    date: "Sep 14, 2026",
    source: "1:1 Meeting",
    client: null,
    project: "Team Development",
    people: ["David Kim (Lead Architect)", "Alex Morgan (EM)"],
    relatedMeeting: "1:1 with David Kim (Dev Lead)",
    relatedTask: null,
    relatedDecision: "David pursuing Staff Engineer promotion by Q1 2027",
    keyDecisions: [
      "David Kim targeting Staff Engineer by end of Q1 2027.",
      "Distributed systems architecture ownership assigned to David.",
      "Junior mentorship program to be led by David starting Q4.",
    ],
    context:
      "David has been with the company for 3 years. He is technically strong but needs to demonstrate cross-team leadership and architectural decision-making to qualify for the Staff Engineer level. This is a retention-critical conversation.",
    pinned: false,
    sortTimestamp: 1726272000000,
  },
];
