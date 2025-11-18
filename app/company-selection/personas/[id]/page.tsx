"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type PersonaRole = {
  label: string;
  matchType?: string;
  keywords?: string[];
  departments?: string[];
  minSeniority?: string;
  confidence?: number;
};

type PersonaConditionalRule = {
  rule: "include" | "exclude";
  whenAll?: string[];
  whenAny?: string[];
  unless?: string[];
  notes?: string;
};

type PersonaCriteria = {
  id: number;
  companyCriteriaId: number | null;
  name: string;
  description?: string;
  language?: string;
  positiveRoles: PersonaRole[];
  negativeRoles: PersonaRole[];
  conditionalRules: PersonaConditionalRule[];
  chatHistory: ChatMessage[];
  lastUserMessage?: string;
  lastAIResponse?: string;
  createdAt: string;
  updatedAt: string;
  companyCriteria?: {
    id: number;
    name: string;
  } | null;
  isUsed?: boolean;
};

type PersonaRoleForm = {
  label: string;
  matchType: string;
  keywords: string;
  departments: string;
  minSeniority: string;
  confidence: string;
};

type PersonaConditionalRuleForm = {
  rule: "include" | "exclude";
  whenAll: string;
  whenAny: string;
  unless: string;
  notes: string;
};

type PersonaFormState = {
  name: string;
  description: string;
  language: string;
  positiveRoles: PersonaRoleForm[];
  negativeRoles: PersonaRoleForm[];
  conditionalRules: PersonaConditionalRuleForm[];
};

type PersonaBriefFormState = {
  summary: string;
  decisionGuidelines: string;
  targetProfiles: string;
  avoidProfiles: string;
  additionalNotes: string;
};

type PersonaBriefDto = {
  summary: string;
  decisionGuidelines: string[];
  targetProfiles: string[];
  avoidProfiles: string[];
  additionalNotes?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

const EMPTY_ROLE: PersonaRoleForm = {
  label: "",
  matchType: "contains",
  keywords: "",
  departments: "",
  minSeniority: "",
  confidence: "",
};

const EMPTY_RULE: PersonaConditionalRuleForm = {
  rule: "include",
  whenAll: "",
  whenAny: "",
  unless: "",
  notes: "",
};

const MATCH_TYPES = ["contains", "exact", "regex", "embedding"];
const SENIORITY_OPTIONS = ["intern", "entry", "junior", "mid", "senior", "manager", "director", "vp", "c_suite", "founder", "owner", "partner", "principal", "executive"];

const EMPTY_BRIEF_FORM: PersonaBriefFormState = {
  summary: "",
  decisionGuidelines: "",
  targetProfiles: "",
  avoidProfiles: "",
  additionalNotes: "",
};

export default function PersonasPage() {
  const params = useParams();
  const router = useRouter();
  const personaId = useMemo(() => {
    const raw = params?.id;
    if (!raw) return null;
    const parsed = Number(Array.isArray(raw) ? raw[0] : raw);
    return Number.isFinite(parsed) ? parsed : null;
  }, [params]);

  const [personas, setPersonas] = useState<PersonaCriteria | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"view" | "chat" | "edit">("view");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [sending, setSending] = useState(false);
  const [shouldGenerate, setShouldGenerate] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [isUsed, setIsUsed] = useState(false);
  const [formState, setFormState] = useState<PersonaFormState | null>(null);
  const [personaBrief, setPersonaBrief] = useState<PersonaBriefDto | null>(null);
  const [briefForm, setBriefForm] = useState<PersonaBriefFormState>(EMPTY_BRIEF_FORM);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (personaId) {
      loadPersonas(personaId);
    } else {
      setError("Brak ID persony w URL");
      setLoading(false);
    }
  }, [personaId]);

  useEffect(() => {
    if (chatContainerRef.current) {
      setTimeout(() => {
        if (chatContainerRef.current) {
          chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
      }, 150);
    }
  }, [chatMessages, sending]);

  const loadPersonas = async (id: number) => {
    try {
      setLoading(true);
      setError(null);

      const personasResponse = await fetch(`/api/company-selection/personas/${id}`);
      const briefResponse = await fetch(`/api/company-selection/personas/${id}/persona-brief`);

      let personasData: any = null;
      if (personasResponse.ok) {
        try {
          personasData = await personasResponse.json();
        } catch (parseError) {
          console.error("[Personas] Nie udało się sparsować odpowiedzi /personas", parseError);
        }
      } else {
        console.warn("[Personas] Błąd API /personas", personasResponse.status, personasResponse.statusText);
      }

      if (personasData?.success) {
        const persona: PersonaCriteria = {
          id: personasData.persona.id,
          companyCriteriaId: personasData.persona.companyCriteriaId,
          name: personasData.persona.name,
          description: personasData.persona.description ?? "",
          language: personasData.persona.language ?? "pl",
          positiveRoles: personasData.persona.positiveRoles ?? [],
          negativeRoles: personasData.persona.negativeRoles ?? [],
          conditionalRules: personasData.persona.conditionalRules ?? [],
          chatHistory: (personasData.persona.chatHistory ?? []) as ChatMessage[],
          lastUserMessage: personasData.persona.lastUserMessage ?? undefined,
          lastAIResponse: personasData.persona.lastAIResponse ?? undefined,
          createdAt: personasData.persona.createdAt,
          updatedAt: personasData.persona.updatedAt,
          companyCriteria: personasData.persona.companyCriteria ?? null,
          isUsed: personasData.persona.isUsed ?? false,
        };

        setPersonas(persona);
        setChatMessages(persona.chatHistory ?? []);
        setFormState(transformPersonaToForm(persona));
        setIsUsed(persona.isUsed || false);
      } else {
        setPersonas(null);
        setChatMessages([]);
        setFormState(null);
      }

      let briefJson: any = null;
      if (briefResponse.ok) {
        try {
          briefJson = await briefResponse.json();
        } catch (parseError) {
          console.error("[Personas] Nie udało się sparsować odpowiedzi /persona-brief", parseError);
        }
      } else if (briefResponse.status !== 404) {
        console.warn("[Personas] Błąd API /persona-brief", briefResponse.status, briefResponse.statusText);
      }

      if (briefJson?.success) {
        const dto: PersonaBriefDto = {
          summary: briefJson.data.summary ?? "",
          decisionGuidelines: briefJson.data.decisionGuidelines ?? [],
          targetProfiles: briefJson.data.targetProfiles ?? [],
          avoidProfiles: briefJson.data.avoidProfiles ?? [],
          additionalNotes: briefJson.data.additionalNotes ?? null,
          createdAt: briefJson.data.createdAt,
          updatedAt: briefJson.data.updatedAt,
        };
        setPersonaBrief(dto);
        setBriefForm(transformBriefToForm(dto));
      } else {
        setPersonaBrief(null);
        setBriefForm({ ...EMPTY_BRIEF_FORM });
      }
    } catch (err) {
      console.error("[Personas] Błąd ładowania", err);
      setError("Nie udało się pobrać danych o personach");
      setPersonas(null);
      setChatMessages([]);
      setFormState(null);
      setPersonaBrief(null);
      setBriefForm({ ...EMPTY_BRIEF_FORM });
    } finally {
      setLoading(false);
    }
  };

  const transformPersonaToForm = (persona: PersonaCriteria): PersonaFormState => {
    const toRoleForm = (role: PersonaRole): PersonaRoleForm => ({
      label: role.label ?? "",
      matchType: role.matchType ?? "contains",
      keywords: (role.keywords ?? []).join(", "),
      departments: (role.departments ?? []).join(", "),
      minSeniority: role.minSeniority ?? "",
      confidence: role.confidence !== undefined ? String(role.confidence) : "",
    });

    const toRuleForm = (rule: PersonaConditionalRule): PersonaConditionalRuleForm => ({
      rule: rule.rule,
      whenAll: (rule.whenAll ?? []).join(", "),
      whenAny: (rule.whenAny ?? []).join(", "),
      unless: (rule.unless ?? []).join(", "),
      notes: rule.notes ?? "",
    });

    return {
      name: persona.name,
      description: persona.description ?? "",
      language: persona.language ?? "pl",
      positiveRoles: (persona.positiveRoles ?? []).map(toRoleForm),
      negativeRoles: (persona.negativeRoles ?? []).map(toRoleForm),
      conditionalRules: (persona.conditionalRules ?? []).map(toRuleForm),
    };
  };

  const transformBriefToForm = (brief: PersonaBriefDto | null): PersonaBriefFormState => ({
    summary: brief?.summary ?? "",
    decisionGuidelines: (brief?.decisionGuidelines ?? []).join("\n"),
    targetProfiles: (brief?.targetProfiles ?? []).join("\n"),
    avoidProfiles: (brief?.avoidProfiles ?? []).join("\n"),
    additionalNotes: brief?.additionalNotes ?? "",
  });

  const parseList = (input: string): string[] => {
    return input
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  };

  const parseLines = (input: string): string[] => {
    return input
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  };

  const handleRoleChange = (
    type: "positiveRoles" | "negativeRoles",
    index: number,
    field: keyof PersonaRoleForm,
    value: string
  ) => {
    setFormState((prev) => {
      if (!prev) return prev;
      const updated = { ...prev };
      const roles = [...updated[type]];
      roles[index] = { ...roles[index], [field]: value };
      updated[type] = roles;
      return updated;
    });
  };

  const handleRuleChange = (index: number, field: keyof PersonaConditionalRuleForm, value: string) => {
    setFormState((prev) => {
      if (!prev) return prev;
      const updated = { ...prev };
      const rules = [...updated.conditionalRules];
      rules[index] = { ...rules[index], [field]: value };
      updated.conditionalRules = rules;
      return updated;
    });
  };

  const addRole = (type: "positiveRoles" | "negativeRoles") => {
    setFormState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        [type]: [...prev[type], { ...EMPTY_ROLE }],
      };
    });
  };

  const removeRole = (type: "positiveRoles" | "negativeRoles", index: number) => {
    setFormState((prev) => {
      if (!prev) return prev;
      const roles = [...prev[type]];
      roles.splice(index, 1);
      return { ...prev, [type]: roles };
    });
  };

  const addRule = () => {
    setFormState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        conditionalRules: [...prev.conditionalRules, { ...EMPTY_RULE }],
      };
    });
  };

  const removeRule = (index: number) => {
    setFormState((prev) => {
      if (!prev) return prev;
      const rules = [...prev.conditionalRules];
      rules.splice(index, 1);
      return { ...prev, conditionalRules: rules };
    });
  };

  const sendMessage = async () => {
    if (!personaId || !messageInput.trim() || sending) return;

    const userMessage: ChatMessage = { role: "user", content: messageInput.trim() };
    setChatMessages((prev) => [...prev, userMessage]);
    setMessageInput("");
    setSending(true);

    try {
      const response = await fetch(`/api/company-selection/personas/${personaId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage.content }),
      });

      const data = await response.json();
      if (!data.success) {
        alert(data.error || "Nie udało się wysłać wiadomości");
        setChatMessages((prev) => prev.slice(0, -1));
        return;
      }

      const aiMessage: ChatMessage = { role: "assistant", content: data.response };
      setChatMessages((prev) => [...prev, aiMessage]);
      setShouldGenerate(Boolean(data.shouldGenerate));

      if (data.data) {
        const persona: PersonaCriteria = {
          id: data.data.id,
          companyCriteriaId: data.data.companyCriteriaId,
          name: data.data.name,
          description: data.data.description ?? "",
          language: data.data.language ?? "pl",
          positiveRoles: data.data.positiveRoles ?? [],
          negativeRoles: data.data.negativeRoles ?? [],
          conditionalRules: data.data.conditionalRules ?? [],
          chatHistory: data.chatHistory ?? [],
          lastUserMessage: data.data.lastUserMessage ?? undefined,
          lastAIResponse: data.data.lastAIResponse ?? undefined,
          createdAt: data.data.createdAt,
          updatedAt: data.data.updatedAt,
        };

        setPersonas(persona);
        setFormState(transformPersonaToForm(persona));
      }
    } catch (err) {
      console.error("[Personas Chat] Błąd", err);
      alert("Błąd połączenia z agentem");
      setChatMessages((prev) => prev.slice(0, -1));
    } finally {
      setSending(false);
    }
  };

  const generatePersonas = async () => {
    if (!personaId) return;

    setGenerating(true);
    try {
      const response = await fetch(`/api/company-selection/personas/${personaId}/chat`, {
        method: "PUT",
      });
      const data = await response.json();

      if (!data.success) {
        alert(data.error || "Nie udało się wygenerować person");
        return;
      }

      const persona: PersonaCriteria = {
        id: data.data.id,
        companyCriteriaId: data.data.companyCriteriaId,
        name: data.data.name,
        description: data.data.description ?? "",
        language: data.data.language ?? "pl",
        positiveRoles: data.data.positiveRoles ?? [],
        negativeRoles: data.data.negativeRoles ?? [],
        conditionalRules: data.data.conditionalRules ?? [],
        chatHistory: data.data.chatHistory ?? [],
        lastUserMessage: data.data.lastUserMessage ?? undefined,
        lastAIResponse: data.data.lastAIResponse ?? undefined,
        createdAt: data.data.createdAt,
        updatedAt: data.data.updatedAt,
      };

      setPersonas(persona);
      setFormState(transformPersonaToForm(persona));
      setChatMessages(persona.chatHistory ?? []);
      setShouldGenerate(false);
      alert("Persony zostały wygenerowane i zapisane");
    } catch (err) {
      console.error("[Personas Generate] Błąd", err);
      alert("Błąd generowania person");
    } finally {
      setGenerating(false);
    }
  };

  const savePersonas = async () => {
    if (!personaId || !formState) return;

    if (!formState.name.trim()) {
      alert("Nazwa konfiguracji jest wymagana");
      return;
    }

    setSaving(true);
    try {
      const toRole = (role: PersonaRoleForm): PersonaRole => ({
        label: role.label,
        matchType: role.matchType || undefined,
        keywords: parseList(role.keywords),
        departments: parseList(role.departments),
        minSeniority: role.minSeniority || undefined,
        confidence: role.confidence ? Number(role.confidence) : undefined,
      });

      const toRule = (rule: PersonaConditionalRuleForm): PersonaConditionalRule => ({
        rule: rule.rule,
        whenAll: parseList(rule.whenAll),
        whenAny: parseList(rule.whenAny),
        unless: parseList(rule.unless),
        notes: rule.notes || undefined,
      });

      const payload = {
        name: formState.name,
        description: formState.description || undefined,
        language: formState.language || undefined,
        positiveRoles: formState.positiveRoles.map(toRole),
        negativeRoles: formState.negativeRoles.map(toRole),
        conditionalRules: formState.conditionalRules.map(toRule),
      };

      const response = await fetch(`/api/company-selection/personas/${personaId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!data.success) {
        alert(data.error || "Nie udało się zapisać person");
        return;
      }

      const briefPayload = {
        summary: briefForm.summary.trim(),
        decisionGuidelines: parseLines(briefForm.decisionGuidelines),
        targetProfiles: parseLines(briefForm.targetProfiles),
        avoidProfiles: parseLines(briefForm.avoidProfiles),
        additionalNotes: briefForm.additionalNotes.trim() ? briefForm.additionalNotes.trim() : null,
      };

      const briefResponse = await fetch(`/api/company-selection/personas/${personaId}/persona-brief`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(briefPayload),
      });

      if (!briefResponse.ok) {
        const errorText = await briefResponse.text();
        let errorMessage = "Nie udało się zapisać briefu";
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorMessage;
        } catch {
          // Jeśli nie można sparsować jako JSON, użyj domyślnego komunikatu
        }
        alert(errorMessage);
        return;
      }

      const briefJson = await briefResponse.json();
      if (!briefJson.success) {
        alert(briefJson.error || "Nie udało się zapisać briefu");
        return;
      }

      await loadPersonas(personaId);
      alert("Persony oraz brief zostały zapisane");
    } catch (err) {
      console.error("[Personas Save] Błąd", err);
      alert("Błąd zapisu person");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!personaId || !personas) return;

    if (
      !confirm(
        `Czy na pewno chcesz usunąć personę "${personas.name}"?\n\n` +
          "Ta operacja jest nieodwracalna."
      )
    ) {
      return;
    }

    setDeleting(true);
    try {
      const response = await fetch(`/api/company-selection/personas/${personaId}`, {
        method: "DELETE",
      });

      const data = await response.json();
      if (data.success) {
        alert("Persona została usunięta pomyślnie!");
        router.push("/company-selection/personas");
      } else {
        if (data.error && data.error.includes("używana w weryfikacjach")) {
          setIsUsed(true);
        }
        alert("Błąd: " + (data.error || "Nie udało się usunąć persony"));
      }
    } catch (error) {
      console.error("Błąd usuwania persony:", error);
      alert("Błąd połączenia z serwerem");
    } finally {
      setDeleting(false);
    }
  };

  const handleDuplicate = async () => {
    if (!personaId || !personas) return;

    setDuplicating(true);
    try {
      const response = await fetch("/api/company-selection/personas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${personas.name} - kopia`,
          description: personas.description || "",
          positiveRoles: personas.positiveRoles || [],
          negativeRoles: personas.negativeRoles || [],
          conditionalRules: personas.conditionalRules || [],
          language: personas.language || "pl",
          // Kopiujemy chatHistory z oryginału, aby kopia miała pełną historię czatu
          chatHistory: personas.chatHistory || [],
          lastUserMessage: personas.lastUserMessage,
          lastAIResponse: personas.lastAIResponse,
          // Nie kopiujemy companyCriteriaId, ponieważ ma constraint @unique
          // Kopia będzie niezależna od oryginalnej persony
          companyCriteriaId: null,
        }),
      });

      const data = await response.json();
      if (data.success && data.persona) {
        router.push(`/company-selection/personas/${data.persona.id}`);
      } else {
        alert("Błąd: " + (data.error || "Nie udało się powielić persony"));
      }
    } catch (error) {
      console.error("Błąd powielania persony:", error);
      alert("Błąd połączenia z serwerem");
    } finally {
      setDuplicating(false);
    }
  };

  const viewContent = useMemo(() => {
    if (!personas) {
      return (
        <div
          style={{
            padding: "2rem",
            backgroundColor: "white",
            borderRadius: "0.5rem",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            textAlign: "center",
          }}
        >
          <h2 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>Brak zdefiniowanych person</h2>
          <p style={{ color: "#6B7280", marginBottom: "2rem" }}>
            Rozpocznij rozmowę z agentem AI, aby zdefiniować persony sprzedażowe.
          </p>
          <button
            onClick={() => setActiveTab("chat")}
            style={{
              padding: "0.75rem 1.5rem",
              backgroundColor: "#3B82F6",
              color: "white",
              border: "none",
              borderRadius: "0.5rem",
              cursor: "pointer",
              fontSize: "1rem",
            }}
          >
            Rozpocznij rozmowę
          </button>
        </div>
      );
    }

    const brief = personaBrief;
    const summaryText = (brief?.summary ?? "").trim();
    const additionalNotesText = (brief?.additionalNotes ?? "").trim();
    const hasBriefContent = Boolean(
      summaryText ||
        (brief?.decisionGuidelines?.length ?? 0) > 0 ||
        (brief?.targetProfiles?.length ?? 0) > 0 ||
        (brief?.avoidProfiles?.length ?? 0) > 0 ||
        additionalNotesText
    );

    const positiveRoleLabels = Array.from(
      new Set((personas.positiveRoles ?? []).map((role) => role.label).filter((label): label is string => Boolean(label && label.trim())))
    );
    const negativeRoleLabels = Array.from(
      new Set((personas.negativeRoles ?? []).map((role) => role.label).filter((label): label is string => Boolean(label && label.trim())))
    );

    const renderRoleList = (title: string, roles: PersonaRole[], accentColor: string) => (
      <div
        style={{
          padding: "1.5rem",
          backgroundColor: "white",
          borderRadius: "0.5rem",
          boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
          border: "1px solid #E5E7EB",
        }}
      >
        <h3 style={{ fontSize: "1.25rem", marginBottom: "1rem", color: accentColor }}>{title}</h3>
        {roles.length === 0 ? (
          <p style={{ color: "#6B7280" }}>Brak zdefiniowanych ról.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {roles.map((role, index) => (
              <div key={`${role.label}-${index}`} style={{ borderBottom: "1px solid #F3F4F6", paddingBottom: "0.75rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong>{role.label}</strong>
                  {role.confidence !== undefined && (
                    <span style={{ fontSize: "0.875rem", color: "#6B7280" }}>Pewność: {(role.confidence * 100).toFixed(0)}%</span>
                  )}
                </div>
                <div style={{ fontSize: "0.9rem", color: "#4B5563", marginTop: "0.5rem" }}>
                  {role.minSeniority && (
                    <div><strong>Min. seniority:</strong> {role.minSeniority}</div>
                  )}
                  {role.keywords && role.keywords.length > 0 && (
                    <div><strong>Słowa kluczowe:</strong> {role.keywords.join(", ")}</div>
                  )}
                  {role.departments && role.departments.length > 0 && (
                    <div><strong>Działy:</strong> {role.departments.join(", ")}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <div
          style={{
            padding: "2rem",
            backgroundColor: "white",
            borderRadius: "0.5rem",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
            <div>
              <h2 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>{personas.name}</h2>
              {personas.description && <p style={{ color: "#6B7280" }}>{personas.description}</p>}
            </div>
            <div style={{ fontSize: "0.85rem", color: "#6B7280", textAlign: "right" }}>
              <div>Język: <strong>{personas.language ?? "pl"}</strong></div>
              <div style={{ marginTop: "0.25rem" }}>Aktualizacja: {new Date(personas.updatedAt).toLocaleString("pl-PL")}</div>
            </div>
          </div>
        </div>

        <div
          style={{
            padding: "1.5rem",
            backgroundColor: "white",
            borderRadius: "0.5rem",
            boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ fontSize: "1.25rem", marginBottom: "1rem", color: "#1F2937" }}>Brief strategiczny</h3>
          {hasBriefContent ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem", color: "#4B5563" }}>
              {summaryText && <p>{summaryText}</p>}

              {brief?.decisionGuidelines && brief.decisionGuidelines.length > 0 && (
                <div>
                  <strong>Wskazówki decyzyjne:</strong>
                  <ul style={{ marginTop: "0.35rem", marginBottom: 0, paddingLeft: "1.2rem" }}>
                    {brief.decisionGuidelines.map((item, index) => (
                      <li key={`guideline-${index}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {brief?.targetProfiles && brief.targetProfiles.length > 0 && (
                <div>
                  <strong>Przykładowe persony (pozytywne):</strong>
                  <ul style={{ marginTop: "0.35rem", marginBottom: 0, paddingLeft: "1.2rem" }}>
                    {brief.targetProfiles.map((item, index) => (
                      <li key={`positive-${index}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {brief?.avoidProfiles && brief.avoidProfiles.length > 0 && (
                <div>
                  <strong>Persony do unikania:</strong>
                  <ul style={{ marginTop: "0.35rem", marginBottom: 0, paddingLeft: "1.2rem" }}>
                    {brief.avoidProfiles.map((item, index) => (
                      <li key={`negative-${index}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {additionalNotesText && (
                <div>
                  <strong>Dodatkowe notatki:</strong>
                  <p style={{ marginTop: "0.35rem" }}>{additionalNotesText}</p>
                </div>
              )}

              {brief?.updatedAt && (
                <div style={{ fontSize: "0.75rem", color: "#9CA3AF" }}>
                  Ostatnia aktualizacja: {new Date(brief.updatedAt).toLocaleString("pl-PL")}
                </div>
              )}
            </div>
          ) : (
            <p style={{ color: "#6B7280" }}>
              Brak zapisanych wskazówek. Uzupełnij brief w zakładce „Edycja ręczna”, aby AI otrzymywało precyzyjny kontekst.
            </p>
          )}
        </div>

        {(positiveRoleLabels.length > 0 || negativeRoleLabels.length > 0) && (
          <div
            style={{
              padding: "1.5rem",
              backgroundColor: "white",
              borderRadius: "0.5rem",
              boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
              border: "1px solid #E5E7EB",
            }}
          >
            <h3 style={{ fontSize: "1.25rem", marginBottom: "0.75rem", color: "#1D4ED8" }}>Aktualne reguły AI (szybkie dopasowania)</h3>
            <p style={{ color: "#6B7280", fontSize: "0.9rem", marginBottom: "1rem" }}>
              Poniższe stanowiska system kwalifikuje automatycznie – zanim poprosi o decyzję model AI. Lista uaktualnia się po zapisaniu zmian w konfiguracji person.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.5rem" }}>
              <div>
                <div style={{ fontWeight: 600, color: "#166534", marginBottom: "0.5rem" }}>Pozytywne persony</div>
                {positiveRoleLabels.length === 0 ? (
                  <div style={{ color: "#9CA3AF", fontStyle: "italic" }}>Brak ustawionych ról pozytywnych.</div>
                ) : (
                  <ul style={{ margin: 0, paddingLeft: "1.2rem", color: "#374151", fontSize: "0.95rem", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                    {positiveRoleLabels.map((label) => (
                      <li key={`positive-summary-${label}`}>{label}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <div style={{ fontWeight: 600, color: "#991b1b", marginBottom: "0.5rem" }}>Negatywne persony</div>
                {negativeRoleLabels.length === 0 ? (
                  <div style={{ color: "#9CA3AF", fontStyle: "italic" }}>Brak ustawionych ról negatywnych.</div>
                ) : (
                  <ul style={{ margin: 0, paddingLeft: "1.2rem", color: "#374151", fontSize: "0.95rem", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                    {negativeRoleLabels.map((label) => (
                      <li key={`negative-summary-${label}`}>{label}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "1rem" }}>
          {renderRoleList("Pozytywne persony", personas.positiveRoles ?? [], "#166534")}
          {renderRoleList("Negatywne persony", personas.negativeRoles ?? [], "#991b1b")}
        </div>

        <div
          style={{
            padding: "1.5rem",
            backgroundColor: "white",
            borderRadius: "0.5rem",
            boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3 style={{ fontSize: "1.25rem", marginBottom: "1rem", color: "#1D4ED8" }}>Reguły warunkowe</h3>
          {(personas.conditionalRules ?? []).length === 0 ? (
            <p style={{ color: "#6B7280" }}>Brak dodatkowych reguł.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {(personas.conditionalRules ?? []).map((rule, index) => (
                <div key={index} style={{ borderBottom: "1px solid #F3F4F6", paddingBottom: "0.75rem" }}>
                  <div><strong>Typ:</strong> {rule.rule === "include" ? "Uwzględnij" : "Wyklucz"}</div>
                  {rule.whenAll && rule.whenAll.length > 0 && (
                    <div><strong>Wszystkie słowa:</strong> {rule.whenAll.join(", ")}</div>
                  )}
                  {rule.whenAny && rule.whenAny.length > 0 && (
                    <div><strong>Dowolne słowa:</strong> {rule.whenAny.join(", ")}</div>
                  )}
                  {rule.unless && rule.unless.length > 0 && (
                    <div><strong>Wyjątki:</strong> {rule.unless.join(", ")}</div>
                  )}
                  {rule.notes && <div><strong>Notatka:</strong> {rule.notes}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }, [personas, personaBrief]);

  if (loading) {
    return (
      <div style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>Ładowanie...</div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
        <p style={{ color: "#DC2626" }}>{error}</p>
        <Link href="/company-selection/criteria" style={{ color: "#3B82F6", textDecoration: "underline" }}>
          Przejdź do konfiguracji kryteriów firm
        </Link>
      </div>
    );
  }

  return (
    <div style={{ padding: "2rem", maxWidth: "1100px", margin: "0 auto" }}>
      <div style={{ marginBottom: "2rem" }}>
        <Link
          href="/company-selection/personas"
          style={{
            color: "#3B82F6",
            textDecoration: "none",
            marginBottom: "1rem",
            display: "inline-block",
          }}
        >
          ← Powrót do listy person
        </Link>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", marginTop: "1rem" }}>
          <div>
            <h1 style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>
              {personas?.name || "Persony sprzedażowe (Agenda AI)"}
            </h1>
            {personas?.description && (
              <p style={{ color: "#6B7280", marginTop: "0.5rem" }}>
                {personas.description}
              </p>
            )}
          </div>
          {personas && (
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
              {isUsed && (
                <div
                  style={{
                    padding: "1rem",
                    backgroundColor: "#FEF3C7",
                    border: "1px solid #F59E0B",
                    borderRadius: "0.5rem",
                    color: "#92400E",
                    fontSize: "0.875rem",
                    flex: 1,
                  }}
                >
                  <strong>Uwaga:</strong> Ta persona jest używana w weryfikacjach.
                  Aby ją usunąć, najpierw usuń powiązane weryfikacje.
                </div>
              )}
              <button
                onClick={handleDuplicate}
                disabled={duplicating}
                style={{
                  padding: "0.75rem 2rem",
                  backgroundColor: duplicating ? "#9CA3AF" : "#3B82F6",
                  color: "white",
                  border: "none",
                  borderRadius: "0.5rem",
                  cursor: duplicating ? "not-allowed" : "pointer",
                  fontSize: "1rem",
                  fontWeight: "500",
                }}
                title="Utwórz kopię tej persony"
              >
                {duplicating ? "Powielanie..." : "Powiel"}
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting || isUsed}
                style={{
                  padding: "0.75rem 2rem",
                  backgroundColor: deleting || isUsed ? "#9CA3AF" : "#EF4444",
                  color: "white",
                  border: "none",
                  borderRadius: "0.5rem",
                  cursor: deleting || isUsed ? "not-allowed" : "pointer",
                  fontSize: "1rem",
                  fontWeight: "500",
                }}
                title={
                  isUsed
                    ? "Nie można usunąć - persona jest używana w weryfikacjach"
                    : "Usuń personę"
                }
              >
                {deleting ? "Usuwanie..." : "Usuń personę"}
              </button>
            </div>
          )}
        </div>
        <p style={{ color: "#6B7280", maxWidth: "750px", marginTop: "1rem" }}>
          Zdefiniuj persony (stanowiska i role) dla kampanii prospectingowych. Rozpocznij rozmowę z agentem, aby zebrać informacje, następnie wygeneruj finalną strukturę lub edytuj ją ręcznie.
        </p>
      </div>

      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          marginBottom: "2rem",
          borderBottom: "2px solid #E5E7EB",
        }}
      >
        {(
          [
            { key: "view", label: "Podgląd" },
            { key: "chat", label: "Czat o personach" },
            { key: "edit", label: "Edycja ręczna" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: "0.75rem 1.5rem",
              border: "none",
              backgroundColor: "transparent",
              borderBottom: activeTab === tab.key ? "2px solid #3B82F6" : "2px solid transparent",
              color: activeTab === tab.key ? "#3B82F6" : "#6B7280",
              cursor: "pointer",
              fontWeight: activeTab === tab.key ? 600 : 400,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "view" && viewContent}

      {activeTab === "chat" && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            height: "620px",
            backgroundColor: "white",
            borderRadius: "0.5rem",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          }}
        >
          <div
            style={{
              padding: "1rem",
              borderBottom: "1px solid #E5E7EB",
              backgroundColor: "#F9FAFB",
              borderRadius: "0.5rem 0.5rem 0 0",
            }}
          >
            <h3 style={{ fontSize: "1.25rem", marginBottom: "0.5rem" }}>Czat o personach z agentem AI</h3>
            <p style={{ fontSize: "0.875rem", color: "#6B7280" }}>
              Opisz, kto jest decydentem zakupowym, jakie stanowiska są najważniejsze oraz kogo unikać. Agent dopyta o szczegóły i zaproponuje listę person.
            </p>
          </div>

          <div
            ref={chatContainerRef}
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "1.5rem",
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
            }}
          >
            {chatMessages.length === 0 ? (
              <div style={{ textAlign: "center", color: "#6B7280", padding: "2rem" }}>
                <p style={{ marginBottom: "1rem" }}>Rozpocznij rozmowę, np.: "Potrzebuję osób decyzyjnych ds. budowy stoisk targowych"</p>
              </div>
            ) : (
              chatMessages.map((msg, idx) => (
                <div key={idx} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                  <div
                    style={{
                      maxWidth: "72%",
                      padding: "1rem",
                      borderRadius: "0.5rem",
                      backgroundColor: msg.role === "user" ? "#3B82F6" : "#F3F4F6",
                      color: msg.role === "user" ? "white" : "#1F2937",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {msg.content}
                  </div>
                </div>
              ))
            )}

            {sending && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div
                  style={{
                    padding: "1rem",
                    borderRadius: "0.5rem",
                    backgroundColor: "#F3F4F6",
                    color: "#6B7280",
                  }}
                >
                  Agent pisze...
                </div>
              </div>
            )}

            {shouldGenerate && chatMessages.length > 0 && (
              <div
                style={{
                  padding: "1rem",
                  backgroundColor: "#FEF3C7",
                  border: "1px solid #F59E0B",
                  borderRadius: "0.5rem",
                  marginTop: "1rem",
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: "0.5rem", color: "#92400E" }}>
                  Agent ma komplet informacji
                </div>
                <div style={{ fontSize: "0.875rem", color: "#78350F", marginBottom: "0.75rem" }}>
                  Kliknij przycisk poniżej, aby wygenerować listę person na podstawie rozmowy.
                </div>
                <button
                  onClick={generatePersonas}
                  disabled={generating}
                  style={{
                    padding: "0.5rem 1rem",
                    backgroundColor: generating ? "#D1D5DB" : "#F59E0B",
                    color: "white",
                    border: "none",
                    borderRadius: "0.25rem",
                    cursor: generating ? "not-allowed" : "pointer",
                    fontSize: "0.875rem",
                    fontWeight: 500,
                  }}
                >
                  {generating ? "Generowanie..." : "Wygeneruj persony"}
                </button>
              </div>
            )}
          </div>

          <div
            style={{
              padding: "1rem",
              borderTop: "1px solid #E5E7EB",
              display: "flex",
              gap: "0.5rem",
              borderRadius: "0 0 0.5rem 0.5rem",
            }}
          >
            <input
              type="text"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Wpisz wiadomość..."
              disabled={sending}
              style={{
                flex: 1,
                padding: "0.75rem",
                border: "1px solid #D1D5DB",
                borderRadius: "0.5rem",
                fontSize: "1rem",
              }}
            />
            <button
              onClick={sendMessage}
              disabled={sending || !messageInput.trim()}
              style={{
                padding: "0.75rem 1.5rem",
                backgroundColor: sending || !messageInput.trim() ? "#9CA3AF" : "#3B82F6",
                color: "white",
                border: "none",
                borderRadius: "0.5rem",
                cursor: sending || !messageInput.trim() ? "not-allowed" : "pointer",
              }}
            >
              Wyślij
            </button>
            {chatMessages.length > 0 && (
              <button
                onClick={generatePersonas}
                disabled={generating}
                style={{
                  padding: "0.75rem 1.5rem",
                  backgroundColor: generating ? "#9CA3AF" : "#10B981",
                  color: "white",
                  border: "none",
                  borderRadius: "0.5rem",
                  cursor: generating ? "not-allowed" : "pointer",
                }}
              >
                {generating ? "Generowanie..." : "Generuj persony"}
              </button>
            )}
          </div>
        </div>
      )}

      {activeTab === "edit" && formState && (
        <div
          style={{
            padding: "2rem",
            backgroundColor: "white",
            borderRadius: "0.5rem",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            display: "flex",
            flexDirection: "column",
            gap: "1.5rem",
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "1.5rem" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <label style={{ fontWeight: 600 }}>Nazwa konfiguracji</label>
              <input
                type="text"
                value={formState.name}
                onChange={(e) => setFormState((prev) => (prev ? { ...prev, name: e.target.value } : prev))}
                style={{ padding: "0.75rem", border: "1px solid #D1D5DB", borderRadius: "0.5rem" }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <label style={{ fontWeight: 600 }}>Język komunikacji</label>
              <input
                type="text"
                value={formState.language}
                onChange={(e) => setFormState((prev) => (prev ? { ...prev, language: e.target.value } : prev))}
                style={{ padding: "0.75rem", border: "1px solid #D1D5DB", borderRadius: "0.5rem" }}
              />
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <label style={{ fontWeight: 600 }}>Opis</label>
            <textarea
              value={formState.description}
              onChange={(e) => setFormState((prev) => (prev ? { ...prev, description: e.target.value } : prev))}
              rows={3}
              style={{ padding: "0.75rem", border: "1px solid #D1D5DB", borderRadius: "0.5rem" }}
            />
          </div>

          <section style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <h3 style={{ fontSize: "1.25rem" }}>Brief strategiczny</h3>
              <p style={{ color: "#6B7280", marginTop: "0.35rem", fontSize: "0.9rem" }}>
                Ten brief jest przekazywany agentowi AI podczas każdej weryfikacji person. Zapisz kluczowe wskazówki, przykładowe stanowiska
                oraz informacje, których AI ma unikać.
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1rem" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <label style={{ fontWeight: 600 }}>Podsumowanie</label>
                <textarea
                  value={briefForm.summary}
                  onChange={(e) => setBriefForm((prev) => ({ ...prev, summary: e.target.value }))}
                  rows={4}
                  placeholder="Najważniejsze cele i wnioski dla prospectingu"
                  style={{ padding: "0.75rem", border: "1px solid #D1D5DB", borderRadius: "0.5rem" }}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <label style={{ fontWeight: 600 }}>Dodatkowe notatki</label>
                <textarea
                  value={briefForm.additionalNotes}
                  onChange={(e) => setBriefForm((prev) => ({ ...prev, additionalNotes: e.target.value }))}
                  rows={4}
                  placeholder="Dodatkowe informacje dla handlowców lub agenta"
                  style={{ padding: "0.75rem", border: "1px solid #D1D5DB", borderRadius: "0.5rem" }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <label style={{ fontWeight: 600 }}>Wskazówki decyzyjne (jedna na linię)</label>
                <textarea
                  value={briefForm.decisionGuidelines}
                  onChange={(e) => setBriefForm((prev) => ({ ...prev, decisionGuidelines: e.target.value }))}
                  rows={5}
                  placeholder={"Np. 1) stanowiska z P&L, 2) osoby z wpływem na produkcję, 3) dyrektorzy zakupów"}
                  style={{ padding: "0.75rem", border: "1px solid #D1D5DB", borderRadius: "0.5rem", fontSize: "0.9rem" }}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <label style={{ fontWeight: 600 }}>Przykładowe persony pozytywne (jedna na linię)</label>
                <textarea
                  value={briefForm.targetProfiles}
                  onChange={(e) => setBriefForm((prev) => ({ ...prev, targetProfiles: e.target.value }))}
                  rows={5}
                  placeholder={"Np. Dyrektor ds. Rozwoju, COO, Head of Operations"}
                  style={{ padding: "0.75rem", border: "1px solid #D1D5DB", borderRadius: "0.5rem", fontSize: "0.9rem" }}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <label style={{ fontWeight: 600 }}>Persony do unikania (jedna na linię)</label>
                <textarea
                  value={briefForm.avoidProfiles}
                  onChange={(e) => setBriefForm((prev) => ({ ...prev, avoidProfiles: e.target.value }))}
                  rows={5}
                  placeholder={"Np. Asystenci, Specjaliści administracyjni, praktykanci"}
                  style={{ padding: "0.75rem", border: "1px solid #D1D5DB", borderRadius: "0.5rem", fontSize: "0.9rem" }}
                />
              </div>
            </div>
          </section>

          <section>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={{ fontSize: "1.25rem" }}>Pozytywne persony</h3>
              <button
                onClick={() => addRole("positiveRoles")}
                style={{
                  padding: "0.5rem 1rem",
                  backgroundColor: "#3B82F6",
                  color: "white",
                  border: "none",
                  borderRadius: "0.5rem",
                  cursor: "pointer",
                }}
              >
                Dodaj rolę
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {formState.positiveRoles.length === 0 && (
                <div style={{ color: "#6B7280" }}>Brak dodanych pozytywnych person.</div>
              )}

              {formState.positiveRoles.map((role, index) => (
                <div
                  key={`positive-${index}`}
                  style={{
                    padding: "1.25rem",
                    border: "1px solid #E5E7EB",
                    borderRadius: "0.5rem",
                    backgroundColor: "#F8FAFC",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.75rem",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <strong>Rola #{index + 1}</strong>
                    <button
                      onClick={() => removeRole("positiveRoles", index)}
                      style={{
                        padding: "0.35rem 0.75rem",
                        backgroundColor: "#EF4444",
                        color: "white",
                        border: "none",
                        borderRadius: "0.35rem",
                        cursor: "pointer",
                      }}
                    >
                      Usuń
                    </button>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.75rem" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                      <label>Label</label>
                      <input
                        type="text"
                        value={role.label}
                        onChange={(e) => handleRoleChange("positiveRoles", index, "label", e.target.value)}
                        style={{ padding: "0.6rem", border: "1px solid #CBD5F5", borderRadius: "0.5rem" }}
                      />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                      <label>Match type</label>
                      <select
                        value={role.matchType}
                        onChange={(e) => handleRoleChange("positiveRoles", index, "matchType", e.target.value)}
                        style={{ padding: "0.6rem", border: "1px solid #CBD5F5", borderRadius: "0.5rem" }}
                      >
                        {MATCH_TYPES.map((type) => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                      <label>Min. seniority</label>
                      <select
                        value={role.minSeniority}
                        onChange={(e) => handleRoleChange("positiveRoles", index, "minSeniority", e.target.value)}
                        style={{ padding: "0.6rem", border: "1px solid #CBD5F5", borderRadius: "0.5rem" }}
                      >
                        <option value="">—</option>
                        {SENIORITY_OPTIONS.map((item) => (
                          <option key={item} value={item}>{item}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                      <label>Pewność (0-1)</label>
                      <input
                        type="number"
                        step="0.05"
                        min="0"
                        max="1"
                        value={role.confidence}
                        onChange={(e) => handleRoleChange("positiveRoles", index, "confidence", e.target.value)}
                        style={{ padding: "0.6rem", border: "1px solid #CBD5F5", borderRadius: "0.5rem" }}
                      />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "0.75rem" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                      <label>Słowa kluczowe (oddziel przecinkami)</label>
                      <input
                        type="text"
                        value={role.keywords}
                        onChange={(e) => handleRoleChange("positiveRoles", index, "keywords", e.target.value)}
                        style={{ padding: "0.6rem", border: "1px solid #CBD5F5", borderRadius: "0.5rem" }}
                      />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                      <label>Działy (oddziel przecinkami)</label>
                      <input
                        type="text"
                        value={role.departments}
                        onChange={(e) => handleRoleChange("positiveRoles", index, "departments", e.target.value)}
                        style={{ padding: "0.6rem", border: "1px solid #CBD5F5", borderRadius: "0.5rem" }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={{ fontSize: "1.25rem" }}>Negatywne persony</h3>
              <button
                onClick={() => addRole("negativeRoles")}
                style={{
                  padding: "0.5rem 1rem",
                  backgroundColor: "#3B82F6",
                  color: "white",
                  border: "none",
                  borderRadius: "0.5rem",
                  cursor: "pointer",
                }}
              >
                Dodaj rolę
              </button>
            </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {formState.negativeRoles.length === 0 && (
              <div style={{ color: "#6B7280" }}>Brak dodanych negatywnych person.</div>
            )}

            {formState.negativeRoles.map((role, index) => (
              <div
                key={`negative-${index}`}
                style={{
                  padding: "1.25rem",
                  border: "1px solid #E5E7EB",
                  borderRadius: "0.5rem",
                  backgroundColor: "#FEF2F2",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong>Rola #{index + 1}</strong>
                  <button
                    onClick={() => removeRole("negativeRoles", index)}
                    style={{
                      padding: "0.35rem 0.75rem",
                      backgroundColor: "#EF4444",
                      color: "white",
                      border: "none",
                      borderRadius: "0.35rem",
                      cursor: "pointer",
                    }}
                  >
                    Usuń
                  </button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.75rem" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                    <label>Label</label>
                    <input
                      type="text"
                      value={role.label}
                      onChange={(e) => handleRoleChange("negativeRoles", index, "label", e.target.value)}
                      style={{ padding: "0.6rem", border: "1px solid #FECACA", borderRadius: "0.5rem" }}
                    />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                    <label>Match type</label>
                    <select
                      value={role.matchType}
                      onChange={(e) => handleRoleChange("negativeRoles", index, "matchType", e.target.value)}
                      style={{ padding: "0.6rem", border: "1px solid #FECACA", borderRadius: "0.5rem" }}
                    >
                      {MATCH_TYPES.map((type) => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                    <label>Pewność (0-1)</label>
                    <input
                      type="number"
                      step="0.05"
                      min="0"
                      max="1"
                      value={role.confidence}
                      onChange={(e) => handleRoleChange("negativeRoles", index, "confidence", e.target.value)}
                      style={{ padding: "0.6rem", border: "1px solid #FECACA", borderRadius: "0.5rem" }}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "0.75rem" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                    <label>Słowa kluczowe</label>
                    <input
                      type="text"
                      value={role.keywords}
                      onChange={(e) => handleRoleChange("negativeRoles", index, "keywords", e.target.value)}
                      style={{ padding: "0.6rem", border: "1px solid #FECACA", borderRadius: "0.5rem" }}
                    />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                    <label>Działy</label>
                    <input
                      type="text"
                      value={role.departments}
                      onChange={(e) => handleRoleChange("negativeRoles", index, "departments", e.target.value)}
                      style={{ padding: "0.6rem", border: "1px solid #FECACA", borderRadius: "0.5rem" }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          </section>

          <section>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={{ fontSize: "1.25rem" }}>Reguły warunkowe</h3>
              <button
                onClick={addRule}
                style={{
                  padding: "0.5rem 1rem",
                  backgroundColor: "#3B82F6",
                  color: "white",
                  border: "none",
                  borderRadius: "0.5rem",
                  cursor: "pointer",
                }}
              >
                Dodaj regułę
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {formState.conditionalRules.length === 0 && (
                <div style={{ color: "#6B7280" }}>Brak zdefiniowanych reguł.</div>
              )}

              {formState.conditionalRules.map((rule, index) => (
                <div
                  key={`rule-${index}`}
                  style={{
                    padding: "1.25rem",
                    border: "1px solid #E5E7EB",
                    borderRadius: "0.5rem",
                    backgroundColor: "#F9FAFB",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.75rem",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <strong>Reguła #{index + 1}</strong>
                    <button
                      onClick={() => removeRule(index)}
                      style={{
                        padding: "0.35rem 0.75rem",
                        backgroundColor: "#EF4444",
                        color: "white",
                        border: "none",
                        borderRadius: "0.35rem",
                        cursor: "pointer",
                      }}
                    >
                      Usuń
                    </button>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.75rem" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                      <label>Typ reguły</label>
                      <select
                        value={rule.rule}
                        onChange={(e) => handleRuleChange(index, "rule", e.target.value as "include" | "exclude")}
                        style={{ padding: "0.6rem", border: "1px solid #CBD5F5", borderRadius: "0.5rem" }}
                      >
                        <option value="include">Uwzględnij (include)</option>
                        <option value="exclude">Wyklucz (exclude)</option>
                      </select>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                      <label>Wszystkie słowa (whenAll)</label>
                      <input
                        type="text"
                        value={rule.whenAll}
                        onChange={(e) => handleRuleChange(index, "whenAll", e.target.value)}
                        style={{ padding: "0.6rem", border: "1px solid #CBD5F5", borderRadius: "0.5rem" }}
                      />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                      <label>Dowolne słowa (whenAny)</label>
                      <input
                        type="text"
                        value={rule.whenAny}
                        onChange={(e) => handleRuleChange(index, "whenAny", e.target.value)}
                        style={{ padding: "0.6rem", border: "1px solid #CBD5F5", borderRadius: "0.5rem" }}
                      />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                      <label>Wyjątki (unless)</label>
                      <input
                        type="text"
                        value={rule.unless}
                        onChange={(e) => handleRuleChange(index, "unless", e.target.value)}
                        style={{ padding: "0.6rem", border: "1px solid #CBD5F5", borderRadius: "0.5rem" }}
                      />
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                    <label>Notatka</label>
                    <textarea
                      value={rule.notes}
                      onChange={(e) => handleRuleChange(index, "notes", e.target.value)}
                      rows={2}
                      style={{ padding: "0.6rem", border: "1px solid #CBD5F5", borderRadius: "0.5rem" }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
            <button
              onClick={savePersonas}
              disabled={saving}
              style={{
                padding: "0.75rem 1.5rem",
                backgroundColor: saving ? "#9CA3AF" : "#10B981",
                color: "white",
                border: "none",
                borderRadius: "0.5rem",
                cursor: saving ? "not-allowed" : "pointer",
                fontSize: "1rem",
              }}
            >
              {saving ? "Zapisywanie..." : "Zapisz persony"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


