// Calcula el inicio del ciclo de facturación vigente a partir de la fecha en que
// se fijó por última vez (activación de plan, renovación de Stripe o inicio de trial).
//
// billing_cycle_start solo se actualiza en eventos puntuales (pago con Stripe,
// renovación, cron mensual de cuentas "active"). Una cuenta que se queda en
// trial vencido sin pasar nunca a pago no dispara ninguno de esos eventos, así
// que su billing_cycle_start quedaría congelado en la fecha original del trial
// para siempre — y el conteo de "pedidos del mes" acabaría sumando pedidos de
// meses o años, mostrando de hecho el total histórico en vez del uso mensual.
//
// Para evitarlo, avanzamos el ciclo mes a mes hasta el periodo mensual vigente,
// preservando el día de anclaje original.
function getEffectiveCycleStart(billingCycleStart) {
  const now = new Date();
  if (!billingCycleStart) return new Date(now.getFullYear(), now.getMonth(), 1);

  let cycleStart = new Date(billingCycleStart);
  while (true) {
    const next = new Date(cycleStart);
    next.setMonth(next.getMonth() + 1);
    if (next > now) break;
    cycleStart = next;
  }
  return cycleStart;
}

module.exports = { getEffectiveCycleStart };
