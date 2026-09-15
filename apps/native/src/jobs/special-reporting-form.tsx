import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  specialReportingMissing,
  type SpecialReportingDraft,
  type YesNoNa,
} from '@/src/lib/special-reporting';
import { colors } from '@/src/theme';

const BOOL_SECTIONS: {
  title: string;
  hint?: string;
  rows: { key: keyof SpecialReportingDraft; label: string }[];
}[] = [
  {
    title: 'Minimum standard',
    hint: 'The landlord must indicate whether the following apply to the premises.',
    rows: [
      { key: 'structurallySound', label: 'Are the premises structurally sound?' },
      { key: 'lighting', label: 'Adequate lighting in each room?' },
      { key: 'ventilation', label: 'Adequate ventilation?' },
      { key: 'outletSockets', label: 'Adequate electricity or gas outlet sockets?' },
      { key: 'plumbingDrainage', label: 'Adequate plumbing and drainage?' },
      { key: 'suppliedElectricity', label: 'Supplied with electricity?' },
      { key: 'suppliedGas', label: 'Supplied with gas?' },
      { key: 'waterSupply', label: 'Connected to a water supply?' },
      { key: 'bathroomFacilities', label: 'Bathroom facilities with privacy?' },
    ],
  },
  {
    title: 'Health issues',
    rows: [
      { key: 'mouldDampness', label: 'Signs of mould and dampness?' },
      { key: 'pestsVermin', label: 'Pests and vermin?' },
      { key: 'rubbishLeft', label: 'Rubbish left on the premises?' },
      { key: 'looseFillAsbestos', label: 'Listed on the Loose-Fill Asbestos Insulation Register?' },
    ],
  },
  {
    title: 'Smoke alarms',
    rows: [
      { key: 'smokeAlarmsInstalled', label: 'Smoke alarms installed (EP&A Act 1979)?' },
      { key: 'smokeAlarmsWorking', label: 'Smoke alarms checked and working?' },
    ],
  },
  {
    title: 'Other safety issues',
    rows: [
      { key: 'damagedAppliances', label: 'Visible damaged appliances?' },
      { key: 'electricityHazards', label: 'Visible electricity hazards?' },
      { key: 'gasHazards', label: 'Visible gas hazards?' },
    ],
  },
  {
    title: 'Communication facilities',
    rows: [
      { key: 'telephoneLine', label: 'Telephone line connected?' },
      { key: 'internetLine', label: 'Internet line connected?' },
    ],
  },
  {
    title: 'Water usage charging and efficiency',
    hint: 'Only applicable if the tenant pays water usage charges.',
    rows: [
      { key: 'separatelyMetered', label: 'Premises separately metered?' },
      { key: 'showerheadsFlow', label: 'Showerheads max 9 L/min?' },
      { key: 'tapsFlow', label: 'Kitchen/bathroom taps max 9 L/min?' },
      { key: 'leaksFixed', label: 'Leaking taps or toilets fixed?' },
    ],
  },
];

function YesNo({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      {([true, false] as const).map((option) => (
        <Pressable
          key={String(option)}
          onPress={() => onChange(option)}
          style={[styles.toggle, value === option && styles.toggleOn]}
        >
          <Text style={[styles.toggleText, value === option && styles.toggleTextOn]}>
            {option ? 'Yes' : 'No'}
          </Text>
        </Pressable>
      ))}
    </View>
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
    <View style={styles.toggleRow}>
      {(['yes', 'no', 'na'] as const).map((option) => (
        <Pressable
          key={option}
          onPress={() => onChange(option)}
          style={[styles.toggle, value === option && styles.toggleOn]}
        >
          <Text style={[styles.toggleText, value === option && styles.toggleTextOn]}>
            {option === 'na' ? 'N/A' : option === 'yes' ? 'Yes' : 'No'}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export function SpecialReportingForm({
  value,
  onChange,
  submitting,
  error,
  onBack,
  onFinalise,
}: {
  value: SpecialReportingDraft;
  onChange: (next: SpecialReportingDraft) => void;
  submitting?: boolean;
  error?: string | null;
  onBack: () => void;
  onFinalise: () => void;
}) {
  const [localError, setLocalError] = useState<string | null>(null);
  const patch = (partial: Partial<SpecialReportingDraft>) => onChange({ ...value, ...partial });
  const shownError = error ?? localError;

  return (
    <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled" style={{ flex: 1 }}>
      <Text style={styles.title}>NSW Special Reporting</Text>
      {shownError ? <Text style={styles.error}>{shownError}</Text> : null}

      {BOOL_SECTIONS.map((section) => (
        <View key={section.title} style={styles.card}>
          <Text style={styles.cardTitle}>{section.title}</Text>
          {section.hint ? <Text style={styles.hint}>{section.hint}</Text> : null}
          {section.rows.map((row) => (
            <View key={row.key} style={styles.question}>
              <Text style={styles.label}>{row.label}</Text>
              <YesNo
                value={Boolean(value[row.key])}
                onChange={(next) => patch({ [row.key]: next } as Partial<SpecialReportingDraft>)}
              />
            </View>
          ))}
          {section.title === 'Smoke alarms' ? (
            <>
              <Text style={styles.label}>Date last checked</Text>
              <TextInput
                value={value.smokeAlarmsLastChecked}
                onChangeText={(smokeAlarmsLastChecked) => patch({ smokeAlarmsLastChecked })}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
              <Text style={styles.label}>Removable batteries replaced in last 12 months</Text>
              <YesNoNaRow
                value={value.smokeRemovableBatteries}
                onChange={(smokeRemovableBatteries) => patch({ smokeRemovableBatteries })}
              />
              <Text style={styles.label}>Date batteries last changed</Text>
              <TextInput
                value={value.smokeRemovableBatteriesDate}
                onChangeText={(smokeRemovableBatteriesDate) =>
                  patch({ smokeRemovableBatteriesDate })
                }
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
              <Text style={styles.label}>Removable lithium batteries replaced per manufacturer</Text>
              <YesNoNaRow
                value={value.smokeLithiumBatteries}
                onChange={(smokeLithiumBatteries) => patch({ smokeLithiumBatteries })}
              />
              <Text style={styles.label}>Date lithium batteries last changed</Text>
              <TextInput
                value={value.smokeLithiumBatteriesDate}
                onChangeText={(smokeLithiumBatteriesDate) =>
                  patch({ smokeLithiumBatteriesDate })
                }
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
            </>
          ) : null}
          {section.title === 'Water usage charging and efficiency' ? (
            <>
              <Text style={styles.label}>Dual flush toilets min 3 star WELS (from 23 Mar 2025)</Text>
              <YesNoNaRow
                value={value.dualFlushToilets}
                onChange={(dualFlushToilets) => patch({ dualFlushToilets })}
              />
              <Text style={styles.label}>Date last checked for water efficiency *</Text>
              <TextInput
                value={value.waterEfficiencyLastChecked}
                onChangeText={(waterEfficiencyLastChecked) =>
                  patch({ waterEfficiencyLastChecked })
                }
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
              <Text style={styles.label}>Water meter reading at START of tenancy *</Text>
              <TextInput
                value={value.waterMeterStart}
                onChangeText={(waterMeterStart) => patch({ waterMeterStart })}
                placeholder="Reading"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
              <Text style={styles.label}>Date of start reading *</Text>
              <TextInput
                value={value.waterMeterStartDate}
                onChangeText={(waterMeterStartDate) => patch({ waterMeterStartDate })}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
              <Text style={styles.label}>Water meter reading at END of tenancy</Text>
              <TextInput
                value={value.waterMeterEnd}
                onChangeText={(waterMeterEnd) => patch({ waterMeterEnd })}
                placeholder="Reading"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
              <Text style={styles.label}>Date of end reading</Text>
              <TextInput
                value={value.waterMeterEndDate}
                onChangeText={(waterMeterEndDate) => patch({ waterMeterEndDate })}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
            </>
          ) : null}
        </View>
      ))}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Additional comments</Text>
        <TextInput
          value={value.additionalComments}
          onChangeText={(additionalComments) => patch({ additionalComments })}
          placeholder="Optional notes"
          placeholderTextColor={colors.muted}
          multiline
          style={[styles.input, styles.notes]}
        />
        <Text style={styles.label}>Installation of water efficiency measures</Text>
        <TextInput
          value={value.waterEfficiencyInstalledDate}
          onChangeText={(waterEfficiencyInstalledDate) =>
            patch({ waterEfficiencyInstalledDate })
          }
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
        <Text style={styles.label}>Painting (external)</Text>
        <TextInput
          value={value.paintingExternalDate}
          onChangeText={(paintingExternalDate) => patch({ paintingExternalDate })}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
        <Text style={styles.label}>Painting (internal)</Text>
        <TextInput
          value={value.paintingInternalDate}
          onChangeText={(paintingInternalDate) => patch({ paintingInternalDate })}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
        <Text style={styles.label}>Flooring laid/replaced/cleaned</Text>
        <TextInput
          value={value.flooringDate}
          onChangeText={(flooringDate) => patch({ flooringDate })}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
        <Text style={styles.label}>Landlord agrees to undertake work</Text>
        <TextInput
          value={value.landlordWork}
          onChangeText={(landlordWork) => patch({ landlordWork })}
          multiline
          style={[styles.input, styles.notes]}
          placeholderTextColor={colors.muted}
        />
        <Text style={styles.label}>Complete work by</Text>
        <TextInput
          value={value.landlordWorkBy}
          onChangeText={(landlordWorkBy) => patch({ landlordWorkBy })}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
        <Text style={styles.label}>Landlord/agent signature</Text>
        <TextInput
          value={value.landlordSignature}
          onChangeText={(landlordSignature) => patch({ landlordSignature })}
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
        <Text style={styles.label}>Signed date</Text>
        <TextInput
          value={value.landlordSignedDate}
          onChangeText={(landlordSignedDate) => patch({ landlordSignedDate })}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
      </View>

      <View style={styles.actions}>
        <Pressable onPress={onBack} style={styles.secondary}>
          <Text style={styles.secondaryText}>Back</Text>
        </Pressable>
        <Pressable
          disabled={submitting}
          onPress={() => {
            const missing = specialReportingMissing(value);
            if (missing) {
              setLocalError(missing);
              return;
            }
            setLocalError(null);
            onFinalise();
          }}
          style={[styles.primary, submitting && styles.disabled]}
        >
          {submitting ? (
            <ActivityIndicator color={colors.primaryFg} />
          ) : (
            <Text style={styles.primaryText}>Finalise</Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  inner: { padding: 16, paddingBottom: 40, gap: 12 },
  title: { color: colors.text, fontSize: 22, fontWeight: '700', textAlign: 'center' },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  hint: { color: colors.muted, fontSize: 11 },
  question: { gap: 6, paddingVertical: 4 },
  label: { color: colors.text, fontSize: 13, lineHeight: 18 },
  toggleRow: { flexDirection: 'row', gap: 8 },
  toggle: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  toggleOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  toggleText: { color: colors.text, fontWeight: '600', fontSize: 12 },
  toggleTextOn: { color: colors.primaryFg },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    borderRadius: 8,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  notes: { minHeight: 80, textAlignVertical: 'top' },
  error: { color: colors.destructive, fontSize: 13 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  primary: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryText: { color: colors.primaryFg, fontWeight: '700' },
  secondary: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryText: { color: colors.text, fontWeight: '600' },
  disabled: { opacity: 0.55 },
});
