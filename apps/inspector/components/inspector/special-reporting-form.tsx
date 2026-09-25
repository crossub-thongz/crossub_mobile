'use client';

import type { ReactNode } from 'react';
import { ChevronLeft, FileCheck, Save } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { SpecialReportingDraft, YesNoNa } from '@/lib/special-reporting';
import { isSpecialReportingNa, specialReportingMissing } from '@/lib/special-reporting';
import { stripEmojis } from '@/lib/strip-emojis';
import { cn } from '@/lib/utils';

function RequiredMark() {
  return <span className="text-destructive ml-1 text-[10px] font-semibold">*Required</span>;
}

function YesNo({
  value,
  onChange,
  unset,
  disabled,
}: {
  value: boolean | null;
  onChange: (value: boolean) => void;
  unset?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="flex shrink-0 items-center gap-3">
      {([true, false] as const).map((option) => {
        const selected = !disabled && value === option;
        return (
          <label key={String(option)} className="flex items-center gap-1.5 text-xs">
            <input
              type="radio"
              checked={selected}
              disabled={disabled}
              onChange={() => {
                if (disabled) return;
                onChange(option);
              }}
              className="accent-primary size-4 disabled:opacity-50"
            />
            <span
              className={cn(
                'text-muted-foreground',
                !disabled && unset && value == null && 'text-muted-foreground',
                !disabled && selected && 'text-foreground font-medium',
                disabled && 'text-muted-foreground',
              )}
            >
              {option ? 'Yes' : 'No'}
            </span>
          </label>
        );
      })}
    </div>
  );
}

function YesNoNaRow({
  value,
  onChange,
}: {
  value: YesNoNa;
  onChange: (value: YesNoNa) => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-3">
      {([
        ['yes', 'Yes'],
        ['no', 'No'],
        ['na', 'N/A'],
      ] as const).map(([option, label]) => (
        <label key={option} className="flex items-center gap-1.5 text-xs">
          <input
            type="radio"
            checked={value === option}
            onChange={() => onChange(option)}
            className="accent-primary size-4"
          />
          <span
            className={
              value === option ? 'text-foreground font-medium' : 'text-muted-foreground'
            }
          >
            {label}
          </span>
        </label>
      ))}
    </div>
  );
}

function QuestionRow({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-foreground text-sm leading-snug">{label}</p>
        {hint ? <p className="text-muted-foreground mt-1 text-[11px] leading-snug">{hint}</p> : null}
        {required ? <RequiredMark /> : null}
      </div>
      {children}
    </div>
  );
}

function DateField({
  id,
  label,
  required,
  value,
  onChange,
  allowNa,
}: {
  id: string;
  label: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  allowNa?: boolean;
}) {
  const markedNa = Boolean(allowNa && isSpecialReportingNa(value));
  return (
    <div className="space-y-1.5 py-1.5">
      <Label htmlFor={id} className="text-sm leading-snug font-normal">
        {label}
        {required ? <RequiredMark /> : null}
      </Label>
      <div className="flex items-stretch gap-2">
        <Input
          id={id}
          type="date"
          disabled={markedNa}
          value={markedNa ? '' : value}
          onChange={(event) => onChange(event.target.value)}
          className="min-w-0 flex-1"
        />
        {allowNa ? (
          <Button
            type="button"
            variant={markedNa ? 'secondary' : 'outline'}
            className="shrink-0"
            onClick={() => onChange(markedNa ? '' : 'na')}
          >
            N/A
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function MeterReadingRow({
  readingId,
  readingLabel,
  reading,
  onReadingChange,
  dateId,
  date,
  onDateChange,
  required,
}: {
  readingId: string;
  readingLabel: string;
  reading: string;
  onReadingChange: (value: string) => void;
  dateId: string;
  date: string;
  onDateChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 items-end gap-3 py-2">
      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor={readingId} className="text-sm leading-snug font-normal">
          {readingLabel}
          {required ? <RequiredMark /> : null}
        </Label>
        <Input
          id={readingId}
          inputMode="decimal"
          value={reading}
          onChange={(event) => onReadingChange(event.target.value)}
        />
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor={dateId} className="text-sm leading-snug font-normal">
          Date of reading:
          {required ? <RequiredMark /> : null}
        </Label>
        <Input
          id={dateId}
          type="date"
          value={date}
          onChange={(event) => onDateChange(event.target.value)}
        />
      </div>
    </div>
  );
}

export function SpecialReportingForm({
  value,
  onChange,
  submitting,
  onBack,
  onFinalise,
  phase = 'ingoing',
}: {
  value: SpecialReportingDraft;
  onChange: (next: SpecialReportingDraft) => void;
  submitting?: boolean;
  onBack: () => void;
  onFinalise: () => void;
  phase?: 'ingoing' | 'outgoing';
}) {
  const patch = (partial: Partial<SpecialReportingDraft>) =>
    onChange({ ...value, ...partial });

  const handleFinalise = () => {
    const missing = specialReportingMissing(value, phase);
    if (missing) {
      toast.error(missing);
      return;
    }
    onFinalise();
  };

  return (
    <>
      <div className="space-y-5 pb-6">
        <button
          type="button"
          onClick={onBack}
          className="text-primary px-1 pt-1 text-left text-sm font-medium"
        >
          <span className="inline-flex items-center gap-1">
            <ChevronLeft className="size-4" />
            Back to areas
          </span>
        </button>
        <h2 className="text-foreground px-1 text-center text-sm font-semibold">
          NSW Special Reporting
        </h2>

      <section className="border-border space-y-1 rounded-xl border bg-card px-3 py-2">
        <h3 className="text-foreground pt-1 text-xs font-bold tracking-wide uppercase">
          Minimum standard
        </h3>
        <p className="text-muted-foreground text-[11px]">
          The landlord must indicate whether the following apply to the premises:
        </p>
        <QuestionRow
          label="1. Are the premises structurally sound?"
          required
          hint="Premises are structurally sound if floors, ceilings, walls, supporting structures, doors, windows, roof, stairs, balconies and railings are in a reasonable state of repair, not liable to collapse, not subject to significant dampness, and do not allow water penetration."
        >
          <YesNo
            value={value.structurallySound}
            onChange={(structurallySound) => patch({ structurallySound })}
          />
        </QuestionRow>
        <p className="text-foreground pt-1 text-sm">2. Does the premises have adequate:</p>
        <QuestionRow
          label="a) Natural or artificial lighting in each room (excluding storage rooms or garages)?"
          required
        >
          <YesNo value={value.lighting} onChange={(lighting) => patch({ lighting })} />
        </QuestionRow>
        <QuestionRow label="b) Ventilation?" required>
          <YesNo
            value={value.ventilation}
            onChange={(ventilation) => patch({ ventilation })}
          />
        </QuestionRow>
        <QuestionRow
          label="c) Electricity outlet sockets or gas outlet sockets for the supply of lighting and heating to the premises, and for the use of appliances in the premises?"
          required
        >
          <YesNo
            value={value.outletSockets}
            onChange={(outletSockets) => patch({ outletSockets })}
          />
        </QuestionRow>
        <QuestionRow label="d) Plumbing and drainage?" required>
          <YesNo
            value={value.plumbingDrainage}
            onChange={(plumbingDrainage) => patch({ plumbingDrainage })}
          />
        </QuestionRow>
        <p className="text-foreground pt-1 text-sm">3. Are the premises:</p>
        <QuestionRow label="a) Supplied with electricity?" required>
          <YesNo
            value={value.suppliedElectricity}
            onChange={(suppliedElectricity) => patch({ suppliedElectricity })}
          />
        </QuestionRow>
        <QuestionRow label="b) Supplied with gas?" required>
          <YesNo
            value={value.suppliedGas}
            onChange={(suppliedGas) => patch({ suppliedGas })}
          />
        </QuestionRow>
        <QuestionRow
          label="c) Connected to a water supply service or infrastructure (including, but not limited to, a water bore or water tank) that is able to supply to the premises hot and cold water for drinking and ablution and cleaning activities?"
          required
        >
          <YesNo
            value={value.waterSupply}
            onChange={(waterSupply) => patch({ waterSupply })}
          />
        </QuestionRow>
        <QuestionRow
          label="4. Does the premises contain bathroom facilities, including toilet and washing facilities that allow privacy for the user?"
          required
        >
          <YesNo
            value={value.bathroomFacilities}
            onChange={(bathroomFacilities) => patch({ bathroomFacilities })}
          />
        </QuestionRow>
        <QuestionRow label="5. Does the tenant agree with all of the above?">
          <YesNo
            disabled
            unset
            value={null}
            onChange={() => undefined}
          />
        </QuestionRow>
        <div className="space-y-1 pb-2">
          <Label htmlFor="min-standard-disagree" className="text-sm font-normal">
            If no, specify which items:
          </Label>
          <textarea
            id="min-standard-disagree"
            rows={3}
            disabled
            value=""
            readOnly
            className="border-input bg-background text-muted-foreground w-full rounded-md border px-3 py-2 text-sm disabled:opacity-60"
          />
        </div>
      </section>

      <section className="border-border space-y-1 rounded-xl border bg-card px-3 py-2">
        <h3 className="text-foreground pt-1 text-xs font-bold tracking-wide uppercase">
          Health issues
        </h3>
        <p className="text-muted-foreground text-[11px]">
          The landlord must indicate whether the following apply to the premises:
        </p>
        <QuestionRow label="a) Are there any signs of mould and dampness?" required>
          <YesNo
            value={value.mouldDampness}
            onChange={(mouldDampness) => patch({ mouldDampness })}
          />
        </QuestionRow>
        <QuestionRow label="b) Are there any pests and vermin?" required>
          <YesNo
            value={value.pestsVermin}
            onChange={(pestsVermin) => patch({ pestsVermin })}
          />
        </QuestionRow>
        <QuestionRow label="c) Has any rubbish been left on the premises?" required>
          <YesNo
            value={value.rubbishLeft}
            onChange={(rubbishLeft) => patch({ rubbishLeft })}
          />
        </QuestionRow>
        <QuestionRow
          label="d) Are the premises listed on the Loose-Fill Asbestos Insulation Register?"
          required
        >
          <YesNo
            value={value.looseFillAsbestos}
            onChange={(looseFillAsbestos) => patch({ looseFillAsbestos })}
          />
        </QuestionRow>
      </section>

      <section className="border-border space-y-1 rounded-xl border bg-card px-3 py-2">
        <h3 className="text-foreground pt-1 text-xs font-bold tracking-wide uppercase">
          Smoke alarms
        </h3>
        <p className="text-muted-foreground text-[11px]">
          The landlord must indicate the following:
        </p>
        <QuestionRow
          label="1. Have smoke alarms been installed in the residential premises in accordance with the Environmental Planning and Assessment Act 1979 (including any regulations made under the Act)?"
          required
        >
          <YesNo
            value={value.smokeAlarmsInstalled}
            onChange={(smokeAlarmsInstalled) => patch({ smokeAlarmsInstalled })}
          />
        </QuestionRow>
        <QuestionRow
          label="2. Have all the smoke alarms installed on the residential premises been checked and found to be in working order?"
          required
        >
          <YesNo
            value={value.smokeAlarmsWorking}
            onChange={(smokeAlarmsWorking) => patch({ smokeAlarmsWorking })}
          />
        </QuestionRow>
        <DateField
          id="smoke-last-checked"
          label="Date last checked:"
          value={value.smokeAlarmsLastChecked}
          onChange={(smokeAlarmsLastChecked) => patch({ smokeAlarmsLastChecked })}
        />
        <QuestionRow
          label="3. Have the removable batteries in all the smoke alarms been replaced within the last 12 months, except for removable lithium batteries?"
          required
        >
          <YesNoNaRow
            value={value.smokeRemovableBatteries}
            onChange={(smokeRemovableBatteries) => patch({ smokeRemovableBatteries })}
          />
        </QuestionRow>
        <DateField
          id="smoke-removable-date"
          label="Date batteries were last changed:"
          value={value.smokeRemovableBatteriesDate}
          onChange={(smokeRemovableBatteriesDate) =>
            patch({ smokeRemovableBatteriesDate })
          }
        />
        <QuestionRow
          label="4. Have the batteries in all the smoke alarms that have a removable lithium battery been replaced in the period specified by the manufacturer of the smoke alarm?"
          required
        >
          <YesNoNaRow
            value={value.smokeLithiumBatteries}
            onChange={(smokeLithiumBatteries) => patch({ smokeLithiumBatteries })}
          />
        </QuestionRow>
        <DateField
          id="smoke-lithium-date"
          label="Date batteries were last changed:"
          value={value.smokeLithiumBatteriesDate}
          onChange={(smokeLithiumBatteriesDate) => patch({ smokeLithiumBatteriesDate })}
        />
        <p className="text-muted-foreground pb-2 text-[11px] italic">
          Note. Section 64A of the Residential Tenancies Act 2010 provides that repairs
          to a smoke alarm includes maintenance of a smoke alarm in working order by
          installing or replacing a battery in the smoke alarm.
        </p>
      </section>

      <section className="border-border space-y-1 rounded-xl border bg-card px-3 py-2">
        <h3 className="text-foreground pt-1 text-xs font-bold tracking-wide uppercase">
          Other safety issues
        </h3>
        <p className="text-muted-foreground text-[11px]">
          The landlord must indicate whether the following apply to the residential
          premises:
        </p>
        <QuestionRow
          label="1. Are there any visible signs of damaged appliances (if appliances are included as part of the tenancy)?"
          required
        >
          <YesNo
            value={value.damagedAppliances}
            onChange={(damagedAppliances) => patch({ damagedAppliances })}
          />
        </QuestionRow>
        <QuestionRow
          label="2. Are there any visible hazards relating to electricity (e.g. a loose or damaged electricity outlet socket, loose wiring or sparking power points)?"
          required
        >
          <YesNo
            value={value.electricityHazards}
            onChange={(electricityHazards) => patch({ electricityHazards })}
          />
        </QuestionRow>
        <QuestionRow
          label="3. Are there any visible hazards relating to gas (e.g. a loose or damaged gas outlet socket or an open-ended gas pipe or valve)?"
          required
        >
          <YesNo
            value={value.gasHazards}
            onChange={(gasHazards) => patch({ gasHazards })}
          />
        </QuestionRow>
        <QuestionRow label="4. Does the tenant agree with all of the above?">
          <YesNo
            disabled
            unset
            value={null}
            onChange={() => undefined}
          />
        </QuestionRow>
        <div className="space-y-1 pb-2">
          <Label htmlFor="safety-disagree" className="text-sm font-normal">
            If no, specify which item:
          </Label>
          <textarea
            id="safety-disagree"
            rows={3}
            disabled
            value=""
            readOnly
            className="border-input bg-background text-muted-foreground w-full rounded-md border px-3 py-2 text-sm disabled:opacity-60"
          />
        </div>
      </section>

      <section className="border-border space-y-1 rounded-xl border bg-card px-3 py-2">
        <h3 className="text-foreground pt-1 text-xs font-bold tracking-wide uppercase">
          Communication facilities
        </h3>
        <p className="text-muted-foreground text-[11px]">
          The landlord must indicate whether the following facilities are available:
        </p>
        <QuestionRow
          label="a) a telephone line is connected to the residential premises"
          required
        >
          <YesNo
            value={value.telephoneLine}
            onChange={(telephoneLine) => patch({ telephoneLine })}
          />
        </QuestionRow>
        <QuestionRow
          label="b) an internet line is connected to the residential premises"
          required
        >
          <YesNo
            value={value.internetLine}
            onChange={(internetLine) => patch({ internetLine })}
          />
        </QuestionRow>
      </section>

      <section className="border-border space-y-1 rounded-xl border bg-card px-3 py-2">
        <h3 className="text-foreground pt-1 text-xs font-bold tracking-wide uppercase">
          Water usage charging and efficiency devices
        </h3>
        <p className="text-muted-foreground text-[11px] italic">
          [only applicable if tenant pays water usage charges for the residential
          premises]
        </p>
        <QuestionRow
          label="1. Are the residential premises separately metered?"
          required
        >
          <YesNo
            value={value.separatelyMetered}
            onChange={(separatelyMetered) => patch({ separatelyMetered })}
          />
        </QuestionRow>
        <p className="text-foreground pt-1 text-sm">
          2. The landlord must indicate the following:
        </p>
        <QuestionRow
          label="a) all showerheads have a maximum flow rate of 9 litres per minute"
          required
        >
          <YesNo
            value={value.showerheadsFlow}
            onChange={(showerheadsFlow) => patch({ showerheadsFlow })}
          />
        </QuestionRow>
        <QuestionRow
          label="b) on and from 23 March 2025, all toilets are dual flush toilets with a minimum 3 star rating in accordance with the WELS scheme"
          required
        >
          <YesNoNaRow
            value={value.dualFlushToilets}
            onChange={(dualFlushToilets) => patch({ dualFlushToilets })}
          />
        </QuestionRow>
        <QuestionRow
          label="c) all internal cold water taps and single mixer taps in kitchen or bathroom hand basins have a maximum flow rate of 9 litres per minute"
          required
        >
          <YesNo value={value.tapsFlow} onChange={(tapsFlow) => patch({ tapsFlow })} />
        </QuestionRow>
        <QuestionRow
          label="d) the premises have been checked and any leaking taps or toilets on the residential premises have been fixed"
          required
        >
          <YesNo value={value.leaksFixed} onChange={(leaksFixed) => patch({ leaksFixed })} />
        </QuestionRow>
        <DateField
          id="water-efficiency-checked"
          label="Date the premises were last checked to see if it is compliant with the water efficiency measures:"
          required
          allowNa
          value={value.waterEfficiencyLastChecked}
          onChange={(waterEfficiencyLastChecked) =>
            patch({ waterEfficiencyLastChecked })
          }
        />
        <MeterReadingRow
          readingId="water-start"
          readingLabel="Water meter reading at START of tenancy:"
          reading={value.waterMeterStart}
          onReadingChange={(waterMeterStart) => patch({ waterMeterStart })}
          dateId="water-start-date"
          date={value.waterMeterStartDate}
          onDateChange={(waterMeterStartDate) => patch({ waterMeterStartDate })}
          required
        />
        {phase === 'outgoing' ? (
          <MeterReadingRow
            readingId="water-end"
            readingLabel="Water meter reading at END of tenancy:"
            reading={value.waterMeterEnd}
            onReadingChange={(waterMeterEnd) => patch({ waterMeterEnd })}
            dateId="water-end-date"
            date={value.waterMeterEndDate}
            onDateChange={(waterMeterEndDate) => patch({ waterMeterEndDate })}
            required
          />
        ) : (
          <p className="text-muted-foreground text-[11px] italic">
            End of tenancy meter reading and date are completed at move-out.
          </p>
        )}
      </section>

      <section className="border-border space-y-2 rounded-xl border bg-card px-3 py-3">
        <h3 className="text-foreground text-xs font-bold tracking-wide uppercase">
          Additional comments / information
        </h3>
        <div className="space-y-1">
          <Label htmlFor="special-notes" className="text-sm font-normal">
            Additional comments on minimum standards, health issues, smoke alarms,
            other safety issues, communication facilities, water usage charging and
            efficiency devices
          </Label>
          <p className="text-muted-foreground text-[11px] italic">
            [may be added by landlord or tenant, or both]
          </p>
          <textarea
            id="special-notes"
            rows={4}
            value={value.additionalComments}
            onChange={(event) => patch({ additionalComments: stripEmojis(event.target.value) })}
            className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <p className="text-foreground pt-1 text-sm font-medium">
          Approximate dates when work last done on residential premises
        </p>
        <DateField
          id="water-installed"
          label="Installation of water efficiency measures"
          value={value.waterEfficiencyInstalledDate}
          onChange={(waterEfficiencyInstalledDate) =>
            patch({ waterEfficiencyInstalledDate })
          }
        />
        <DateField
          id="paint-ext"
          label="Painting of premises (external)"
          value={value.paintingExternalDate}
          onChange={(paintingExternalDate) => patch({ paintingExternalDate })}
        />
        <DateField
          id="paint-int"
          label="Painting of premises (internal)"
          value={value.paintingInternalDate}
          onChange={(paintingInternalDate) => patch({ paintingInternalDate })}
        />
        <DateField
          id="flooring"
          label="Flooring laid/replaced/cleaned"
          value={value.flooringDate}
          onChange={(flooringDate) => patch({ flooringDate })}
        />
        <p className="text-foreground pt-2 text-sm font-medium">
          Landlord&apos;s promise to undertake work
        </p>
        <p className="text-muted-foreground text-[11px] italic">
          [Delete if not required] Further items and comments may be added on additional
          pages signed by the landlord/agent and the tenant and attached to this report.
        </p>
        <div className="space-y-1">
          <Label htmlFor="landlord-work" className="text-sm font-normal">
            The landlord agrees to undertake the following cleaning, repairs, additions
            or other work during the tenancy:
          </Label>
          <textarea
            id="landlord-work"
            rows={4}
            value={value.landlordWork}
            onChange={(event) => patch({ landlordWork: stripEmojis(event.target.value) })}
            className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <DateField
          id="landlord-work-by"
          label="The landlord agrees to complete that work by:"
          value={value.landlordWorkBy}
          onChange={(landlordWorkBy) => patch({ landlordWorkBy })}
        />
        <div className="space-y-1">
          <Label htmlFor="landlord-sig" className="text-sm font-normal">
            Landlord/agent&apos;s signature:
          </Label>
          <Input
            id="landlord-sig"
            value={value.landlordSignature}
            onChange={(event) => patch({ landlordSignature: event.target.value })}
          />
        </div>
        <DateField
          id="landlord-signed"
          label="Date:"
          value={value.landlordSignedDate}
          onChange={(landlordSignedDate) => patch({ landlordSignedDate })}
        />
      </section>
      </div>

      <div
        className="fixed left-1/2 z-50 w-full max-w-lg -translate-x-1/2 border-t border-border bg-background px-4 py-3"
        style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="flex items-center justify-between gap-3">
          <Button type="button" variant="outline" size="sm" onClick={onBack}>
            <ChevronLeft className="size-3.5" />
            Back to areas
          </Button>
          <div className="flex gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => toast.success('Special reporting saved')}
            >
              <Save className="size-3.5" />
              Save
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={submitting}
              onClick={handleFinalise}
            >
              <FileCheck className="size-3.5" />
              {submitting ? 'Submitting…' : 'Finalise'}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
