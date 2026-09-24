import type { SaveInspectorFindings } from '@/src/api/inspector';

type FindingsArea = SaveInspectorFindings['areas'][number];
type FindingsItem = NonNullable<FindingsArea['items']>[number];

export type YesNoNa = 'yes' | 'no' | 'na';

export const SPECIAL_REPORTING_NA = 'na';

export function isSpecialReportingNa(value: string | undefined): boolean {
  return (value ?? '').trim().toLowerCase() === SPECIAL_REPORTING_NA;
}

/** NSW Special Reporting is the Fair Trading condition-report page on Ingoing and Outgoing only. */
export function inspectionHasNswSpecialReporting(
  type: string,
): type is 'ingoing' | 'outgoing' {
  return type === 'ingoing' || type === 'outgoing';
}

export type SpecialReportingDraft = {
  structurallySound: boolean;
  lighting: boolean;
  ventilation: boolean;
  outletSockets: boolean;
  plumbingDrainage: boolean;
  suppliedElectricity: boolean;
  suppliedGas: boolean;
  waterSupply: boolean;
  bathroomFacilities: boolean;
  minStandardTenantAgrees: boolean | null;
  minStandardTenantDisagreeNote: string;

  mouldDampness: boolean;
  pestsVermin: boolean;
  rubbishLeft: boolean;
  looseFillAsbestos: boolean;

  smokeAlarmsInstalled: boolean;
  smokeAlarmsWorking: boolean;
  smokeAlarmsLastChecked: string;
  smokeRemovableBatteries: YesNoNa;
  smokeRemovableBatteriesDate: string;
  smokeLithiumBatteries: YesNoNa;
  smokeLithiumBatteriesDate: string;

  damagedAppliances: boolean;
  electricityHazards: boolean;
  gasHazards: boolean;
  safetyTenantAgrees: boolean | null;
  safetyTenantDisagreeNote: string;

  telephoneLine: boolean;
  internetLine: boolean;

  separatelyMetered: boolean;
  showerheadsFlow: boolean;
  dualFlushToilets: YesNoNa;
  tapsFlow: boolean;
  leaksFixed: boolean;
  waterEfficiencyLastChecked: string;
  waterMeterStart: string;
  waterMeterStartDate: string;
  waterMeterEnd: string;
  waterMeterEndDate: string;

  additionalComments: string;
  waterEfficiencyInstalledDate: string;
  paintingExternalDate: string;
  paintingInternalDate: string;
  flooringDate: string;
  landlordWork: string;
  landlordWorkBy: string;
  landlordSignature: string;
  landlordSignedDate: string;
};

/** Filled-version defaults for the inspector. */
export function defaultSpecialReporting(): SpecialReportingDraft {
  return {
    structurallySound: true,
    lighting: true,
    ventilation: true,
    outletSockets: true,
    plumbingDrainage: true,
    suppliedElectricity: true,
    suppliedGas: true,
    waterSupply: true,
    bathroomFacilities: true,
    minStandardTenantAgrees: null,
    minStandardTenantDisagreeNote: '',

    mouldDampness: false,
    pestsVermin: false,
    rubbishLeft: false,
    looseFillAsbestos: false,

    smokeAlarmsInstalled: true,
    smokeAlarmsWorking: true,
    smokeAlarmsLastChecked: '',
    smokeRemovableBatteries: 'na',
    smokeRemovableBatteriesDate: '',
    smokeLithiumBatteries: 'na',
    smokeLithiumBatteriesDate: '',

    damagedAppliances: false,
    electricityHazards: false,
    gasHazards: false,
    safetyTenantAgrees: null,
    safetyTenantDisagreeNote: '',

    telephoneLine: true,
    internetLine: true,

    separatelyMetered: true,
    showerheadsFlow: true,
    dualFlushToilets: 'na',
    tapsFlow: true,
    leaksFixed: true,
    waterEfficiencyLastChecked: '',
    waterMeterStart: '',
    waterMeterStartDate: '',
    waterMeterEnd: '',
    waterMeterEndDate: '',

    additionalComments: '',
    waterEfficiencyInstalledDate: '',
    paintingExternalDate: '',
    paintingInternalDate: '',
    flooringDate: '',
    landlordWork: '',
    landlordWorkBy: '',
    landlordSignature: '',
    landlordSignedDate: '',
  };
}

function asBool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asBoolNull(value: unknown, fallback: boolean | null): boolean | null {
  return value === true || value === false || value === null ? value : fallback;
}

function asYesNoNa(value: unknown, fallback: YesNoNa): YesNoNa {
  return value === 'yes' || value === 'no' || value === 'na' ? value : fallback;
}

function asStr(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

export function mergeSpecialReporting(
  saved: Partial<SpecialReportingDraft> | null | undefined,
): SpecialReportingDraft {
  const defaults = defaultSpecialReporting();
  if (!saved) return defaults;
  const legacy = saved as Partial<SpecialReportingDraft> & {
    waterMeter?: string;
  };
  return {
    structurallySound: asBool(saved.structurallySound, defaults.structurallySound),
    lighting: asBool(saved.lighting, defaults.lighting),
    ventilation: asBool(saved.ventilation, defaults.ventilation),
    outletSockets: asBool(saved.outletSockets, defaults.outletSockets),
    plumbingDrainage: asBool(saved.plumbingDrainage, defaults.plumbingDrainage),
    suppliedElectricity: asBool(saved.suppliedElectricity, defaults.suppliedElectricity),
    suppliedGas: asBool(saved.suppliedGas, defaults.suppliedGas),
    waterSupply: asBool(saved.waterSupply, defaults.waterSupply),
    bathroomFacilities: asBool(saved.bathroomFacilities, defaults.bathroomFacilities),
    minStandardTenantAgrees: asBoolNull(
      saved.minStandardTenantAgrees,
      defaults.minStandardTenantAgrees,
    ),
    minStandardTenantDisagreeNote: asStr(
      saved.minStandardTenantDisagreeNote,
      defaults.minStandardTenantDisagreeNote,
    ),

    mouldDampness: asBool(saved.mouldDampness, defaults.mouldDampness),
    pestsVermin: asBool(saved.pestsVermin, defaults.pestsVermin),
    rubbishLeft: asBool(saved.rubbishLeft, defaults.rubbishLeft),
    looseFillAsbestos: asBool(saved.looseFillAsbestos, defaults.looseFillAsbestos),

    smokeAlarmsInstalled: asBool(
      saved.smokeAlarmsInstalled,
      defaults.smokeAlarmsInstalled,
    ),
    smokeAlarmsWorking: asBool(saved.smokeAlarmsWorking, defaults.smokeAlarmsWorking),
    smokeAlarmsLastChecked: asStr(
      saved.smokeAlarmsLastChecked,
      defaults.smokeAlarmsLastChecked,
    ),
    smokeRemovableBatteries: asYesNoNa(
      saved.smokeRemovableBatteries,
      defaults.smokeRemovableBatteries,
    ),
    smokeRemovableBatteriesDate: asStr(
      saved.smokeRemovableBatteriesDate,
      defaults.smokeRemovableBatteriesDate,
    ),
    smokeLithiumBatteries: asYesNoNa(
      saved.smokeLithiumBatteries,
      defaults.smokeLithiumBatteries,
    ),
    smokeLithiumBatteriesDate: asStr(
      saved.smokeLithiumBatteriesDate,
      defaults.smokeLithiumBatteriesDate,
    ),

    damagedAppliances: asBool(saved.damagedAppliances, defaults.damagedAppliances),
    electricityHazards: asBool(saved.electricityHazards, defaults.electricityHazards),
    gasHazards: asBool(saved.gasHazards, defaults.gasHazards),
    safetyTenantAgrees: asBoolNull(
      saved.safetyTenantAgrees,
      defaults.safetyTenantAgrees,
    ),
    safetyTenantDisagreeNote: asStr(
      saved.safetyTenantDisagreeNote,
      defaults.safetyTenantDisagreeNote,
    ),

    telephoneLine: asBool(saved.telephoneLine, defaults.telephoneLine),
    internetLine: asBool(saved.internetLine, defaults.internetLine),

    separatelyMetered: asBool(saved.separatelyMetered, defaults.separatelyMetered),
    showerheadsFlow: asBool(saved.showerheadsFlow, defaults.showerheadsFlow),
    dualFlushToilets: asYesNoNa(saved.dualFlushToilets, defaults.dualFlushToilets),
    tapsFlow: asBool(saved.tapsFlow, defaults.tapsFlow),
    leaksFixed: asBool(saved.leaksFixed, defaults.leaksFixed),
    waterEfficiencyLastChecked: asStr(
      saved.waterEfficiencyLastChecked,
      defaults.waterEfficiencyLastChecked,
    ),
    waterMeterStart: asStr(
      saved.waterMeterStart ?? legacy.waterMeter,
      defaults.waterMeterStart,
    ),
    waterMeterStartDate: asStr(saved.waterMeterStartDate, defaults.waterMeterStartDate),
    waterMeterEnd: asStr(saved.waterMeterEnd, defaults.waterMeterEnd),
    waterMeterEndDate: asStr(saved.waterMeterEndDate, defaults.waterMeterEndDate),

    additionalComments: asStr(saved.additionalComments, defaults.additionalComments),
    waterEfficiencyInstalledDate: asStr(
      saved.waterEfficiencyInstalledDate,
      defaults.waterEfficiencyInstalledDate,
    ),
    paintingExternalDate: asStr(
      saved.paintingExternalDate,
      defaults.paintingExternalDate,
    ),
    paintingInternalDate: asStr(
      saved.paintingInternalDate,
      defaults.paintingInternalDate,
    ),
    flooringDate: asStr(saved.flooringDate, defaults.flooringDate),
    landlordWork: asStr(saved.landlordWork, defaults.landlordWork),
    landlordWorkBy: asStr(saved.landlordWorkBy, defaults.landlordWorkBy),
    landlordSignature: asStr(saved.landlordSignature, defaults.landlordSignature),
    landlordSignedDate: asStr(saved.landlordSignedDate, defaults.landlordSignedDate),
  };
}

/** Empty-version required fields that the filled defaults do not already answer. */
export function specialReportingMissing(
  draft: SpecialReportingDraft,
  phase: 'ingoing' | 'outgoing' = 'ingoing',
): string | null {
  if (!draft.waterEfficiencyLastChecked.trim()) {
    return 'Enter the date water efficiency measures were last checked, or mark N/A';
  }
  if (!draft.waterMeterStart.trim()) {
    return 'Enter the water meter reading at the start of the tenancy';
  }
  if (!draft.waterMeterStartDate.trim()) {
    return 'Enter the date of the start water meter reading';
  }
  if (phase === 'outgoing') {
    if (!draft.waterMeterEnd.trim()) {
      return 'Enter the water meter reading at the end of the tenancy';
    }
    if (!draft.waterMeterEndDate.trim()) {
      return 'Enter the date of the end water meter reading';
    }
  }
  return null;
}

const yesNo = (value: boolean) => (value ? 'Yes' : 'No');
const yesNoNa = (value: YesNoNa) =>
  value === 'yes' ? 'Yes' : value === 'no' ? 'No' : 'N/A';

function item(
  name: string,
  comment: string | undefined,
  extra?: { flagged?: boolean; reading?: string },
): FindingsItem {
  return {
    name,
    comment: comment?.trim() || undefined,
    flagged: extra?.flagged,
    reading: extra?.reading?.trim() || undefined,
  };
}

export function specialReportingAsFindings(
  draft: SpecialReportingDraft,
): FindingsArea {
  const items: FindingsItem[] = [
    item('Minimum standard — structurally sound', yesNo(draft.structurallySound), {
      flagged: !draft.structurallySound,
    }),
    item('Adequate lighting', yesNo(draft.lighting), { flagged: !draft.lighting }),
    item('Adequate ventilation', yesNo(draft.ventilation), {
      flagged: !draft.ventilation,
    }),
    item('Adequate electricity or gas outlet sockets', yesNo(draft.outletSockets), {
      flagged: !draft.outletSockets,
    }),
    item('Adequate plumbing and drainage', yesNo(draft.plumbingDrainage), {
      flagged: !draft.plumbingDrainage,
    }),
    item('Supplied with electricity', yesNo(draft.suppliedElectricity), {
      flagged: !draft.suppliedElectricity,
    }),
    item('Supplied with gas', yesNo(draft.suppliedGas), {
      flagged: !draft.suppliedGas,
    }),
    item('Connected to a water supply', yesNo(draft.waterSupply), {
      flagged: !draft.waterSupply,
    }),
    item('Bathroom facilities with privacy', yesNo(draft.bathroomFacilities), {
      flagged: !draft.bathroomFacilities,
    }),
    item(
      'Tenant agrees with minimum standard',
      'Not answered',
    ),

    item('Signs of mould and dampness', yesNo(draft.mouldDampness), {
      flagged: draft.mouldDampness,
    }),
    item('Pests and vermin', yesNo(draft.pestsVermin), {
      flagged: draft.pestsVermin,
    }),
    item('Rubbish left on the premises', yesNo(draft.rubbishLeft), {
      flagged: draft.rubbishLeft,
    }),
    item('Loose-fill asbestos insulation register', yesNo(draft.looseFillAsbestos), {
      flagged: draft.looseFillAsbestos,
    }),

    item(
      'Smoke alarms installed (EP&A Act 1979)',
      yesNo(draft.smokeAlarmsInstalled),
      { flagged: !draft.smokeAlarmsInstalled },
    ),
    item('Smoke alarms checked and working', yesNo(draft.smokeAlarmsWorking), {
      flagged: !draft.smokeAlarmsWorking,
    }),
    ...(draft.smokeAlarmsLastChecked.trim()
      ? [item('Smoke alarms date last checked', draft.smokeAlarmsLastChecked)]
      : []),
    item(
      'Removable smoke alarm batteries replaced in last 12 months',
      yesNoNa(draft.smokeRemovableBatteries),
      { flagged: draft.smokeRemovableBatteries === 'no' },
    ),
    ...(draft.smokeRemovableBatteriesDate.trim()
      ? [item('Removable batteries last changed', draft.smokeRemovableBatteriesDate)]
      : []),
    item(
      'Removable lithium batteries replaced per manufacturer',
      yesNoNa(draft.smokeLithiumBatteries),
      { flagged: draft.smokeLithiumBatteries === 'no' },
    ),
    ...(draft.smokeLithiumBatteriesDate.trim()
      ? [item('Lithium batteries last changed', draft.smokeLithiumBatteriesDate)]
      : []),

    item('Visible damaged appliances', yesNo(draft.damagedAppliances), {
      flagged: draft.damagedAppliances,
    }),
    item('Visible electricity hazards', yesNo(draft.electricityHazards), {
      flagged: draft.electricityHazards,
    }),
    item('Visible gas hazards', yesNo(draft.gasHazards), {
      flagged: draft.gasHazards,
    }),
    item(
      'Tenant agrees with other safety issues',
      'Not answered',
    ),

    item('Telephone line connected', yesNo(draft.telephoneLine), {
      flagged: !draft.telephoneLine,
    }),
    item('Internet line connected', yesNo(draft.internetLine), {
      flagged: !draft.internetLine,
    }),

    item('Premises separately metered', yesNo(draft.separatelyMetered)),
    item('Showerheads max 9 L/min', yesNo(draft.showerheadsFlow), {
      flagged: !draft.showerheadsFlow,
    }),
    item(
      'Dual flush toilets min 3 star WELS (from 23 Mar 2025)',
      yesNoNa(draft.dualFlushToilets),
      { flagged: draft.dualFlushToilets === 'no' },
    ),
    item('Kitchen/bathroom taps max 9 L/min', yesNo(draft.tapsFlow), {
      flagged: !draft.tapsFlow,
    }),
    item('Leaking taps or toilets fixed', yesNo(draft.leaksFixed), {
      flagged: !draft.leaksFixed,
    }),
    item(
      'Water efficiency last checked',
      isSpecialReportingNa(draft.waterEfficiencyLastChecked)
        ? 'N/A'
        : draft.waterEfficiencyLastChecked,
    ),
    item('Water meter reading at START of tenancy', undefined, {
      reading: draft.waterMeterStart,
    }),
    item('Date of start water meter reading', draft.waterMeterStartDate),
    ...(draft.waterMeterEnd.trim()
      ? [item('Water meter reading at END of tenancy', undefined, {
          reading: draft.waterMeterEnd,
        })]
      : []),
    ...(draft.waterMeterEndDate.trim()
      ? [item('Date of end water meter reading', draft.waterMeterEndDate)]
      : []),

    ...(draft.additionalComments.trim()
      ? [item('Additional comments', draft.additionalComments)]
      : []),
    ...(draft.waterEfficiencyInstalledDate.trim()
      ? [item('Installation of water efficiency measures', draft.waterEfficiencyInstalledDate)]
      : []),
    ...(draft.paintingExternalDate.trim()
      ? [item('Painting of premises (external)', draft.paintingExternalDate)]
      : []),
    ...(draft.paintingInternalDate.trim()
      ? [item('Painting of premises (internal)', draft.paintingInternalDate)]
      : []),
    ...(draft.flooringDate.trim()
      ? [item('Flooring laid/replaced/cleaned', draft.flooringDate)]
      : []),
    ...(draft.landlordWork.trim()
      ? [item('Landlord agrees to undertake work', draft.landlordWork)]
      : []),
    ...(draft.landlordWorkBy.trim()
      ? [item('Landlord agrees to complete work by', draft.landlordWorkBy)]
      : []),
    ...(draft.landlordSignature.trim()
      ? [item("Landlord/agent's signature", draft.landlordSignature)]
      : []),
    ...(draft.landlordSignedDate.trim()
      ? [item('Landlord/agent signed date', draft.landlordSignedDate)]
      : []),
  ];

  return {
    name: 'Special Reporting',
    rating: 'Good',
    items,
  };
}
