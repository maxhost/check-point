"use client";
import { Xmark } from "iconoir-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { read } from "../../../../demo";
import { ConfirmDialog } from "../../../../components/confirm-dialog";
import {
  type WeeklySchedule,
  WeeklySchedulePicker,
  validateWeeklySchedule,
} from "../../../../components/weekly-schedule";
type CampaignGoal = "welcome" | "return" | "reactivate" | "demand" | "loyalty";
type Reward = "points" | "stamps" | "coupon" | "game";
type CampaignCondition = "first_visit" | "returning" | "inactive" | "time_slot";
type RewardConfigurationProps = {
  goal: CampaignGoal;
  reward: Reward;
  rewards: Reward[];
  onChange: (reward: Reward) => void;
};
const rewardCopy: Record<Reward, { title: string; description: string }> = {
  points: {
    title: "Puntos",
    description: "Refuerza el saldo del programa activo.",
  },
  stamps: {
    title: "Sello extra",
    description: "Acerca al cliente a completar su tarjeta.",
  },
  coupon: {
    title: "Cupón",
    description: "Entrega valor inmediato y medible al canjear.",
  },
  game: {
    title: "Oportunidad de juego",
    description: "Ofrece una experiencia sorpresa con límite por persona.",
  },
};
const allowedRewards: Record<CampaignGoal, Reward[]> = {
  welcome: ["coupon", "points"],
  return: ["stamps", "points"],
  reactivate: ["coupon", "game"],
  demand: ["points", "stamps", "coupon"],
  loyalty: [],
};
const recommended: Record<CampaignGoal, Reward> = {
  welcome: "coupon",
  return: "stamps",
  reactivate: "coupon",
  demand: "points",
  loyalty: "coupon",
};
const defaultCondition: Record<CampaignGoal, CampaignCondition> = {
  welcome: "first_visit",
  return: "returning",
  reactivate: "inactive",
  demand: "time_slot",
  loyalty: "first_visit",
};
const goals: Record<
  CampaignGoal,
  {
    title: string;
    description: string;
    metric: string;
  }
> = {
  welcome: {
    title: "Atraer tráfico",
    description:
      "Lleva personas nuevas al local y convierte su primera visita.",
    metric: "Visitas válidas y clientes nuevos",
  },
  return: {
    title: "Fidelizar",
    description: "Construye recurrencia con el programa activo del negocio.",
    metric: "Retorno y progreso de fidelidad",
  },
  reactivate: {
    title: "Reactivación",
    description: "Recupera clientes que dejaron de venir.",
    metric: "Clientes reactivados",
  },
  demand: {
    title: "Impulsar una franja",
    description: "Mueve demanda hacia días u horarios objetivos.",
    metric: "Interacciones en la franja objetivo",
  },
  loyalty: {
    title: "Solicitar feedback genuino",
    description:
      "Invita a compartir una experiencia real, sin ofrecer incentivos.",
    metric: "Solicitudes y clics al enlace de reseña",
  },
};
const steps = ["Constructor", "Fechas y horarios", "Revisar"];
function RewardSentence({
  goal,
  reward,
  rewards,
  onChange,
}: RewardConfigurationProps) {
  if (!rewards.length) {
    return (
      <p className="notice">
        Activa un programa de fidelización compatible para usar este objetivo.
      </p>
    );
  }

  return (
    <div className="rule-line rule-effect">
      <span>entregar</span>
      <select
        value={reward}
        onChange={(event) => onChange(event.target.value as Reward)}
        aria-label="Incentivo"
      >
        {rewards.map((item) => (
          <option value={item} key={item}>
            {item === recommended[goal] ? "Recomendado · " : ""}
            {rewardCopy[item].title}
          </option>
        ))}
      </select>
      {reward === "coupon" && (
        <>
          <span>del beneficio</span>
          <select aria-label="Beneficio">
            <option>2x1 en cerveza</option>
            <option>10% en la bebida del día</option>
          </select>
          <span>válido durante</span>
          <select aria-label="Vigencia del beneficio">
            <option>7 días</option>
            <option>24 horas</option>
            <option>30 días</option>
          </select>
        </>
      )}
      {reward === "points" && (
        <>
          <input
            aria-label="Cantidad de puntos"
            type="number"
            min="1"
            defaultValue="10"
          />
          <span>puntos</span>
        </>
      )}
      {reward === "stamps" && (
        <>
          <input
            aria-label="Cantidad de sellos"
            type="number"
            min="1"
            defaultValue="1"
          />
          <span>sello</span>
        </>
      )}
      {reward === "game" && (
        <>
          <span>para</span>
          <select aria-label="Juego">
            <option>Ruleta de bienvenida</option>
          </select>
        </>
      )}
      <span>con límite de</span>
      <select aria-label="Límite de emisión">
        <option>1 por persona al día</option>
        <option>1 por persona durante la campaña</option>
      </select>
    </div>
  );
}
export default function NewCampaignPage() {
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<CampaignGoal>("welcome");
  const [reward, setReward] = useState<Reward>("coupon");
  const [condition, setCondition] = useState<CampaignCondition>("first_visit");
  const [programType, setProgramType] = useState<"points" | "stamps" | null>(
    null,
  );
  const [name, setName] = useState("");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [schedule, setSchedule] = useState<WeeklySchedule>({
    Lunes: [{ start: "15:00", end: "17:00" }],
    Miércoles: [{ start: "15:00", end: "17:00" }],
    Viernes: [{ start: "15:00", end: "17:00" }],
  });
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const router = useRouter();
  useEffect(() => {
    const program = read()?.loyaltyProgram;
    setProgramType(program?.status === "active" ? program.type : null);
  }, []);
  const rewardsFor = (nextGoal: CampaignGoal) =>
    allowedRewards[nextGoal].filter((item) =>
      item === "points" || item === "stamps" ? programType === item : true,
    );
  const chooseGoal = (nextGoal: CampaignGoal) => {
    setGoal(nextGoal);
    setCondition(defaultCondition[nextGoal]);
    const choices = rewardsFor(nextGoal);
    setReward(
      choices.includes(recommended[nextGoal])
        ? recommended[nextGoal]
        : (choices[0] ?? "coupon"),
    );
  };

  const nextStep = () => {
    if (step === 1) {
      if (!startsOn || !endsOn) {
        setCalendarError("Indica el inicio y fin de la campaña.");
        return;
      }
      if (startsOn > endsOn) {
        setCalendarError(
          "La fecha de inicio debe ser anterior a la fecha de fin.",
        );
        return;
      }
      const scheduleError = validateWeeklySchedule(schedule);
      if (scheduleError) {
        setCalendarError(scheduleError);
        return;
      }
    }
    if (step === 0 && rewardsFor(goal).length === 0 && goal !== "loyalty") {
      return;
    }
    setCalendarError(null);
    setStep((current) => current + 1);
  };
  return (
    <main className="campaign-wizard">
      <header>
        <div>
          <p className="eyebrow">Nueva campaña</p>
          <strong>
            Paso {step + 1} de {steps.length} · {steps[step]}
          </strong>
        </div>
        <button
          className="close-module"
          onClick={() => setConfirmClose(true)}
          aria-label="Cancelar campaña"
        >
          <Xmark aria-hidden="true" />
        </button>
      </header>
      <div className="wizard-progress">
        {steps.map((_, i) => (
          <i className={i <= step ? "active" : ""} key={i} />
        ))}
      </div>
      <section className="wizard-body">
        {step === 0 && (
          <>
            <h1>Construye la regla</h1>
            <p>
              El objetivo recomienda una regla inicial; puedes ajustar sus
              partes.
            </p>
            <p className="notice">
              Para <strong>{goals[goal].title}</strong> mediremos:{" "}
              <strong>{goals[goal].metric}</strong>
            </p>
            <div className="rule-builder">
              <div className="rule-line">
                <span>Quiero</span>
                <select
                  value={goal}
                  onChange={(event) =>
                    chooseGoal(event.target.value as CampaignGoal)
                  }
                  aria-label="Objetivo de negocio"
                >
                  {Object.entries(goals).map(([key, item]) => (
                    <option value={key} key={key}>
                      {item.title.toLowerCase()}
                    </option>
                  ))}
                </select>
              </div>
              <div className="rule-line">
                <span>cuando</span>
                <select aria-label="Disparador">
                  <option>una persona hace check-in</option>
                  <option>una persona vuelve y hace check-in</option>
                </select>
                <select
                  value={condition}
                  onChange={(event) =>
                    setCondition(event.target.value as CampaignCondition)
                  }
                  aria-label="Condición"
                >
                  <option value="first_visit">por primera vez</option>
                  <option value="returning">dentro de 14 días</option>
                  <option value="inactive">
                    después de 30 días sin visitar
                  </option>
                  <option value="time_slot">en la franja elegida</option>
                </select>
              </div>
              {goal === "loyalty" && (
                <>
                  <div className="rule-line">
                    <span>y enviar una invitación a</span>
                    <select
                      aria-label="Destino de la solicitud"
                      defaultValue="google"
                    >
                      <option value="google">Perfil de Google</option>
                      <option value="survey">Encuesta propia</option>
                    </select>
                  </div>
                  <label>
                    Enlace para abrir
                    <input placeholder="https://…" inputMode="url" />
                  </label>
                  <p className="notice">
                    Google prohíbe ofrecer descuentos, puntos o premios a cambio
                    de una reseña. Esta campaña no entrega un incentivo.
                  </p>
                </>
              )}
              {goal !== "loyalty" && (
                <RewardSentence
                  goal={goal}
                  reward={reward}
                  rewards={rewardsFor(goal)}
                  onChange={setReward}
                />
              )}
            </div>
            <p className="field-help">
              Para campañas de ticket, permanencia, productos o rutas primero
              necesitaremos conectar POS, una señal de duración o el directorio.
            </p>
          </>
        )}
        {step === 1 && (
          <>
            <h1>Elige cuándo se activa</h1>
            <label>
              Nombre de campaña
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Viernes de bienvenida"
              />
            </label>
            <label>
              Inicio
              <input
                type="date"
                value={startsOn}
                onChange={(event) => setStartsOn(event.target.value)}
              />
            </label>
            <label>
              Fin
              <input
                type="date"
                value={endsOn}
                onChange={(event) => setEndsOn(event.target.value)}
              />
            </label>
            <WeeklySchedulePicker
              value={schedule}
              onChange={setSchedule}
              error={calendarError}
            />
          </>
        )}
        {step === 2 && (
          <>
            <h1>Revisa tu campaña</h1>
            <p>
              {name || "Campaña sin nombre"} · {goals[goal].title}
            </p>
            <p>
              Vigente del {startsOn || "—"} al {endsOn || "—"}, en los días y
              horarios elegidos.
            </p>
            <p className="notice">
              Mediremos: <strong>{goals[goal].metric}</strong>
            </p>
            {goal !== "loyalty" && (
              <p>
                Incentivo principal: <strong>{rewardCopy[reward].title}</strong>
              </p>
            )}
          </>
        )}
      </section>
      <footer>
        <button
          className="button alt"
          disabled={step === 0}
          onClick={() => setStep(step - 1)}
        >
          Atrás
        </button>
        {step < 2 ? (
          <button className="button" onClick={nextStep}>
            Continuar
          </button>
        ) : (
          <Link className="button" href="/backoffice/demo/campaigns">
            Crear y activar
          </Link>
        )}
      </footer>
      <ConfirmDialog
        open={confirmClose}
        title="¿Abandonar la campaña?"
        description="Los cambios que hiciste se perderán."
        confirmLabel="Abandonar"
        cancelLabel="Seguir editando"
        onCancel={() => setConfirmClose(false)}
        onConfirm={() => router.push("/backoffice/demo/campaigns")}
      />
    </main>
  );
}
