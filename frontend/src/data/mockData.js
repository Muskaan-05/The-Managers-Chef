/**
 * Mock Data for The Manager's Chef Dashboard
 * 
 * DESIGNED TO MATCH BACKEND API CONTRACT (see /backend/docs/API_CONTRACT.md):
 * - /api/dashboard
 * - /api/context/search
 * - /api/meetings/brief
 * 
 * Replace this module with live API calls once backend endpoints are deployed.
 */

export const mockCurrentUser = {
  id: "usr_94b8e21a",
  name: "Alex Morgan",
  role: "Engineering Manager",
  greetingRole: "Manager",
  email: "alex.morgan@company.internal",
  avatarInitials: "AM",
  status: "Active Briefing",
};

export const mockAiBriefItems = [
  {
    id: "brief-1",
    type: "meeting",
    badgeLabel: "Upcoming Meeting",
    badgeColor: "amber",
    title: "Sprint Alignment with Tech Leads",
    description: "Prep notes ready: 2 unresolved questions regarding Q4 migration timelines and API schema sign-off.",
    timeLabel: "Today • 10:30 AM (in 45m)",
    isHighPriority: true,
  },
  {
    id: "brief-2",
    type: "followup",
    badgeLabel: "Important Follow-up",
    badgeColor: "indigo",
    title: "Client X SLA Delivery Verification",
    description: "Elena flagged a 48h buffer requirement in the Sept 12 sync. Final sign-off needed before Friday EOD.",
    timeLabel: "Due Today • 03:00 PM",
    isHighPriority: false,
  },
  {
    id: "brief-3",
    type: "decision",
    badgeLabel: "Recent Decision",
    badgeColor: "emerald",
    title: "ContextItem Denormalized Indexing Model",
    description: "Architecture team approved keeping ContextItem as a search index while domain tables hold truth.",
    timeLabel: "Decided Yesterday • Arch Review",
    isHighPriority: false,
  },
  {
    id: "brief-4",
    type: "task",
    badgeLabel: "Pending Task",
    badgeColor: "rose",
    title: "Approve Cloud Budget Reallocation",
    description: "Requires manager signature to unlock additional compute clusters for the staging benchmark run.",
    timeLabel: "Action Required • By 5:00 PM",
    isHighPriority: true,
  },
];

export const mockRelevantMemories = [
  {
    id: "mem-1",
    title: "Client X Deadline",
    summary: "During the Sept 12 meeting, the client requested delivery before Friday to allow their QA lead a 48h acceptance window.",
    dateSource: "Sep 12 • Meeting Transcript",
    category: "Commitment",
    tagColor: "amber",
  },
  {
    id: "mem-2",
    title: "Q4 Staffing & Hiring Order",
    summary: "Agreed with VP of Eng to prioritize 1 Senior Distributed Systems Engineer before reopening junior positions.",
    dateSource: "Sep 10 • 1:1 with VP Eng",
    category: "Decision",
    tagColor: "emerald",
  },
  {
    id: "mem-3",
    title: "Security & HMAC Ingestion Protocol",
    summary: "All incoming third-party webhooks must validate SHA-256 HMAC headers prior to queuing in Redis.",
    dateSource: "Sep 08 • Security Review",
    category: "Policy",
    tagColor: "indigo",
  },
  {
    id: "mem-4",
    title: "On-call Escalation Rule for P1s",
    summary: "If a P1 incident is unacknowledged within 7 minutes, page the secondary lead and notify #incident-leads immediately.",
    dateSource: "Aug 29 • Incident Post-Mortem",
    category: "Operations",
    tagColor: "slate",
  },
];

export const mockUpcomingItems = [
  {
    id: "up-1",
    type: "meeting",
    title: "Sprint Alignment with Tech Leads",
    subtitle: "Elena R., Marcus T., David K.",
    time: "10:30 AM",
    duration: "45 min",
    status: "upcoming",
    statusLabel: "Soon",
  },
  {
    id: "up-2",
    type: "task",
    title: "Send revised contract clause to Legal",
    subtitle: "Ref: Clause 4.2 Data Retention",
    time: "01:15 PM",
    duration: "15 min",
    status: "normal",
    statusLabel: "Task",
  },
  {
    id: "up-3",
    type: "meeting",
    title: "Product Strategy & Roadmap Sync",
    subtitle: "VP Product, Lead Architect",
    time: "02:30 PM",
    duration: "60 min",
    status: "normal",
    statusLabel: "Calendar",
  },
  {
    id: "up-4",
    type: "commitment",
    title: "Follow-up check: Client X SLA milestone",
    subtitle: "Verify staging sign-off with Sarah",
    time: "04:00 PM",
    duration: "20 min",
    status: "important",
    statusLabel: "Follow-up",
  },
  {
    id: "up-5",
    type: "meeting",
    title: "1:1 with David Kim (Dev Lead)",
    subtitle: "Bi-weekly career development",
    time: "Tomorrow, 09:30 AM",
    duration: "30 min",
    status: "tomorrow",
    statusLabel: "Tomorrow",
  },
];

export const mockInitialTasks = [
  {
    id: "task-1",
    title: "Approve Cloud Budget Reallocation",
    description: "Requires manager signature to unlock additional compute clusters for the staging benchmark run.",
    priority: "high",
    dueDate: "Today, 5:00 PM",
    rawDueDate: "2026-09-28T17:00",
    project: "Staging Benchmark",
    status: "pending",
  },
  {
    id: "task-2",
    title: "Client X SLA Delivery Verification",
    description: "Elena flagged a 48h buffer requirement in the Sept 12 sync. Final sign-off needed before Friday EOD.",
    priority: "high",
    dueDate: "Yesterday, 3:00 PM",
    rawDueDate: "2026-09-27T15:00",
    project: "Client X SLA",
    status: "overdue",
  },
  {
    id: "task-3",
    title: "Sprint Alignment with Tech Leads",
    description: "Prep notes ready: 2 unresolved questions regarding Q4 migration timelines and API schema sign-off.",
    priority: "high",
    dueDate: "Today, 10:30 AM",
    rawDueDate: "2026-09-28T10:30",
    project: "Sprint Planning",
    status: "pending",
    meeting: {
      title: "Sprint Alignment with Tech Leads",
      time: "Today • 10:30 AM (in 45m)",
      link: "https://meet.google.com/chef-spr-sync",
      attendees: "Elena R., Marcus T., David K.",
      agenda: "Review Q4 migration roadmap & API schema architecture approvals.",
    },
  },
  {
    id: "task-4",
    title: "Send revised contract clause to Legal",
    description: "Ref: Clause 4.2 Data Retention policy updates requested by external counsel.",
    priority: "medium",
    dueDate: "Today, 1:15 PM",
    rawDueDate: "2026-09-28T13:15",
    project: "Legal & Compliance",
    status: "pending",
  },
  {
    id: "task-5",
    title: "1:1 with David Kim (Dev Lead)",
    description: "Bi-weekly career development, distributed systems hiring priorities, and team health.",
    priority: "medium",
    dueDate: "Tomorrow, 9:30 AM",
    rawDueDate: "2026-09-29T09:30",
    project: "Engineering Team",
    status: "pending",
    meeting: {
      title: "1:1 with David Kim (Dev Lead)",
      time: "Tomorrow • 09:30 AM (30 min)",
      link: "https://meet.google.com/chef-1on1-dk",
      attendees: "David Kim, Alex Morgan",
      agenda: "Discuss distributed systems hire prioritization and Q4 capacity plan.",
    },
  },
  {
    id: "task-6",
    title: "Security & HMAC Webhook Validation Audit",
    description: "Verify all incoming third-party webhooks validate SHA-256 HMAC headers prior to Redis queueing.",
    priority: "low",
    dueDate: "Oct 02, 2026",
    rawDueDate: "2026-10-02T18:00",
    project: "Security & Compliance",
    status: "pending",
  },
  {
    id: "task-7",
    title: "ContextItem Denormalized Indexing RFC Sign-off",
    description: "Architecture team approved keeping ContextItem as a search index while domain tables hold truth.",
    priority: "high",
    dueDate: "Sep 26, 2026",
    rawDueDate: "2026-09-26T12:00",
    project: "Core Architecture",
    status: "completed",
  },
  {
    id: "task-8",
    title: "Review On-call Escalation Rule for P1s in PagerDuty",
    description: "Updated pager routing to secondary lead within 7 minutes in incident management directory.",
    priority: "medium",
    dueDate: "Sep 25, 2026",
    rawDueDate: "2026-09-25T16:00",
    project: "DevOps & SRE",
    status: "completed",
  },
];

export const mockInitialMeetings = [
  {
    id: "meet-1",
    title: "Sprint Alignment with Tech Leads",
    clientProject: "Sprint Planning",
    meetingType: "Team Sync",
    date: "Today",
    time: "10:30 AM - 11:15 AM",
    timeLabel: "Today · 10:30 AM (in 45m)",
    participants: ["Elena Rostova (Tech Lead)", "Marcus Thorne (Backend)", "David Kim (Lead Architect)", "Alex Morgan (EM)"],
    location: "Google Meet",
    meetingLink: "https://meet.google.com/chef-spr-sync",
    status: "today",
    needsFollowUp: false,
    agenda: "1. Finalize Q4 migration timelines\n2. Review API schema sign-off and backward compatibility\n3. Address unresolved staging benchmark compute allocation",
    previousContext: "In last week's sync on Sept 18, Marcus raised database failover concerns during migration. Elena promised to benchmark read replica latency before sign-off.",
    relatedMemories: [
      { title: "ContextItem Denormalized Indexing Model", dateSource: "Yesterday • Arch Review", summary: "Keep ContextItem as search index while domain tables hold truth." },
      { title: "Security & HMAC Ingestion Protocol", dateSource: "Sep 08 • Security Review", summary: "Validate SHA-256 HMAC headers prior to Redis queuing." }
    ],
    relatedTasks: [
      { id: "task-1", title: "Approve Cloud Budget Reallocation", status: "pending", dueDate: "Today, 5:00 PM", priority: "high" }
    ],
    notes: "",
    keyDecisions: [],
    actionItems: []
  },
  {
    id: "meet-2",
    title: "Client X — Product Review",
    clientProject: "Client X SLA",
    meetingType: "Client Review",
    date: "Today",
    time: "03:00 PM - 04:00 PM",
    timeLabel: "Today · 3:00 PM · Project Alpha",
    participants: ["Sarah Vance (Client X Lead)", "Elena Rostova (Tech Lead)", "Alex Morgan (EM)"],
    location: "Zoom",
    meetingLink: "https://zoom.us/j/984210394",
    status: "today",
    needsFollowUp: true,
    agenda: "1. Deliverable demonstration of v2 data pipeline\n2. Confirm 48h QA acceptance window\n3. SLA contract clause review with legal rep",
    previousContext: "Sept 12 sync established that Client X requires a strict 48h acceptance window prior to production cutover. Sarah requested weekly milestone verification.",
    relatedMemories: [
      { title: "Client X Deadline", dateSource: "Sep 12 • Meeting Transcript", summary: "Client requested delivery before Friday to allow their QA lead a 48h acceptance window." }
    ],
    relatedTasks: [
      { id: "task-2", title: "Client X SLA Delivery Verification", status: "overdue", dueDate: "Yesterday, 3:00 PM", priority: "high" }
    ],
    notes: "",
    keyDecisions: [],
    actionItems: []
  },
  {
    id: "meet-3",
    title: "Product Strategy & Roadmap Sync",
    clientProject: "Core Product",
    meetingType: "Strategy",
    date: "Today",
    time: "02:30 PM - 03:30 PM",
    timeLabel: "Today · 02:30 PM (60 min)",
    participants: ["VP Product", "Lead Architect", "Alex Morgan (EM)"],
    location: "Conference Room 4B",
    meetingLink: "https://meet.google.com/chef-prod-sync",
    status: "today",
    needsFollowUp: false,
    agenda: "1. Review Q4 key company OKRs\n2. Capacity allocation between features vs tech debt\n3. Distributed systems hiring roadmap",
    previousContext: "Agreed in August executive sync that tech debt reduction should account for at least 25% of engineering sprint capacity.",
    relatedMemories: [
      { title: "Q4 Staffing & Hiring Order", dateSource: "Sep 10 • 1:1 with VP Eng", summary: "Prioritize 1 Senior Distributed Systems Engineer before reopening junior positions." }
    ],
    relatedTasks: [],
    notes: "",
    keyDecisions: [],
    actionItems: []
  },
  {
    id: "meet-4",
    title: "1:1 with David Kim (Dev Lead)",
    clientProject: "Team Development",
    meetingType: "1:1",
    date: "Tomorrow",
    time: "09:30 AM - 10:00 AM",
    timeLabel: "Tomorrow · 09:30 AM (30 min)",
    participants: ["David Kim (Lead Architect)", "Alex Morgan (EM)"],
    location: "Google Meet",
    meetingLink: "https://meet.google.com/chef-1on1-dk",
    status: "upcoming",
    needsFollowUp: false,
    agenda: "1. Career development goals & architect level progression\n2. Distributed systems hiring pipeline review\n3. Team burnout & on-call load check",
    previousContext: "Last 1:1 on Sept 14: David felt on-call paging frequency was high on weekends. Mentioned need for clear secondary escalation rules.",
    relatedMemories: [
      { title: "On-call Escalation Rule for P1s", dateSource: "Aug 29 • Incident Post-Mortem", summary: "Page secondary lead if unacknowledged within 7 minutes." }
    ],
    relatedTasks: [
      { id: "task-5", title: "1:1 with David Kim (Dev Lead)", status: "pending", dueDate: "Tomorrow, 9:30 AM", priority: "medium" }
    ],
    notes: "",
    keyDecisions: [],
    actionItems: []
  },
  {
    id: "meet-5",
    title: "Q4 Architecture Review: ContextItem Indexing",
    clientProject: "Core Architecture",
    meetingType: "Architecture Review",
    date: "Yesterday",
    time: "04:00 PM - 05:00 PM",
    timeLabel: "Yesterday · 04:00 PM (Completed)",
    participants: ["Staff Architect", "Tech Leads", "Alex Morgan (EM)"],
    location: "Google Meet",
    meetingLink: "https://meet.google.com/chef-arch-rev",
    status: "completed",
    needsFollowUp: false,
    agenda: "Decide whether ContextItem denormalized model stays as a pure search index or becomes an authoritative entity store.",
    previousContext: "Previous spike demonstrated Postgres jsonb indexing provided 3x lower latency compared to secondary external Elasticsearch cluster.",
    relatedMemories: [
      { title: "ContextItem Denormalized Indexing Model", dateSource: "Yesterday • Arch Review", summary: "Architecture team approved keeping ContextItem as search index while domain tables hold truth." }
    ],
    relatedTasks: [
      { id: "task-7", title: "ContextItem Denormalized Indexing RFC Sign-off", status: "completed", dueDate: "Sep 26, 2026", priority: "high" }
    ],
    notes: "Thorough discussion on index invalidation. Marcus agreed to implement CDC (change data capture) listeners rather than synchronous write-through hooks.",
    keyDecisions: [
      "Approved keeping ContextItem purely as a denormalized search index.",
      "Primary domain entities remain single source of truth in PostgreSQL.",
      "Agreed to utilize Redis stream for cache invalidation events."
    ],
    actionItems: [
      { text: "Publish architecture decision record (ADR-104) to engineering repo", done: true },
      { text: "Benchmark memory consumption with 500k denormalized records", done: false }
    ]
  },
  {
    id: "meet-6",
    title: "Client X Contract & Buffer Sync",
    clientProject: "Client X SLA",
    meetingType: "Client Review",
    date: "Sep 12, 2026",
    time: "11:00 AM - 12:00 PM",
    timeLabel: "Sep 12, 2026 · Completed",
    participants: ["Elena Rostova", "Client X Legal Rep", "Alex Morgan (EM)"],
    location: "Zoom",
    meetingLink: "https://zoom.us/j/849129841",
    status: "completed",
    needsFollowUp: true,
    agenda: "Establish release buffer protocols and SLA penalty clauses.",
    previousContext: "Client expressed hesitation about Friday deployments without weekend on-call coverage.",
    relatedMemories: [
      { title: "Client X Deadline", dateSource: "Sep 12 • Meeting Transcript", summary: "Elena flagged 48h buffer requirement in Sept 12 sync." }
    ],
    relatedTasks: [
      { id: "task-4", title: "Send revised contract clause to Legal", status: "pending", dueDate: "Today, 1:15 PM", priority: "medium" }
    ],
    notes: "Elena agreed that all major release candidates will be frozen on Wednesdays to ensure a full 48h buffer before Friday sign-off.",
    keyDecisions: [
      "Agreed on Wednesday release cut-off for Client X staging deployments.",
      "Added Clause 4.2 Data Retention requirement to draft contract."
    ],
    actionItems: [
      { text: "Deliver revised Clause 4.2 to internal legal counsel for approval", done: false },
      { text: "Confirm test runner environment readiness with Client X QA lead", done: true }
    ]
  },
  {
    id: "meet-7",
    title: "P1 Incident Post-Mortem & On-call Routing",
    clientProject: "DevOps & SRE",
    meetingType: "Incident Post-Mortem",
    date: "Aug 29, 2026",
    time: "02:00 PM - 03:00 PM",
    timeLabel: "Aug 29, 2026 · Completed",
    participants: ["On-call Leads", "SRE Team", "Alex Morgan (EM)"],
    location: "Google Meet",
    meetingLink: "https://meet.google.com/chef-incident-rev",
    status: "completed",
    needsFollowUp: false,
    agenda: "Review August 28 database connection pool exhaustion incident and response timeline.",
    previousContext: "Alert was delayed by 14 minutes due to misconfigured escalation policy in PagerDuty.",
    relatedMemories: [
      { title: "On-call Escalation Rule for P1s", dateSource: "Aug 29 • Incident Post-Mortem", summary: "If a P1 incident is unacknowledged within 7 minutes, page secondary lead." }
    ],
    relatedTasks: [
      { id: "task-8", title: "Review On-call Escalation Rule for P1s in PagerDuty", status: "completed", dueDate: "Sep 25, 2026", priority: "medium" }
    ],
    notes: "Root cause identified: Connection leak in stale background worker threads during Redis reconnection storms.",
    keyDecisions: [
      "Adopted strict 7-minute secondary escalation rule for all severity 1 pages.",
      "Added circuit breaker around third-party webhook ingestion queue."
    ],
    actionItems: [
      { text: "Configure 7-minute escalation timeout in PagerDuty services", done: true },
      { text: "Schedule quarterly incident drill with distributed leads", done: true }
    ]
  }
];


