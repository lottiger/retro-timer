import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Backdrop } from '../components/Backdrop';
import { EdgeShadow } from '../components/EdgeShadow';
import { useTheme } from '../theme';
import type { Settings } from '../settings';

interface HomeScreenProps {
	settings: Settings;
	onChangeSettings: (patch: Partial<Settings>) => void;
	onPickDuration: (seconds: number) => void;
	onPickCustom: () => void;
	onPickChess: () => void;
}

const OPTIONS = [
	{ label: '30 sec', seconds: 30 },
	{ label: '1 min', seconds: 60 },
	{ label: '1 min 30', seconds: 90 },
	{ label: '2 min', seconds: 120 },
] as const;

export function HomeScreen({
	settings,
	onChangeSettings,
	onPickDuration,
	onPickCustom,
	onPickChess,
}: HomeScreenProps) {
	const insets = useSafeAreaInsets();
	const theme = useTheme();

	const toggle = (key: 'sound' | 'haptics') => {
		const next = !settings[key];
		onChangeSettings({ [key]: next });
		if (key === 'haptics' ? next : settings.haptics) {
			Haptics.selectionAsync().catch(() => {});
		}
	};

	const THEME_ORDER = ['system', 'dark', 'light'] as const;
	const THEME_LABEL = {
		system: 'Auto',
		dark: 'Dark',
		light: 'Light',
	} as const;
	const cycleTheme = () => {
		const idx = THEME_ORDER.indexOf(settings.themeMode);
		onChangeSettings({
			themeMode: THEME_ORDER[(idx + 1) % THEME_ORDER.length],
		});
		if (settings.haptics) Haptics.selectionAsync().catch(() => {});
	};

	return (
		<View
			style={[
				styles.root,
				{
					backgroundColor: theme.bg,
					paddingTop: insets.top,
					paddingBottom: insets.bottom,
				},
			]}
		>
			<Backdrop />
			<Text style={[styles.wordmark, { color: theme.faint }]}>
				Hourglass
			</Text>
			<EdgeShadow direction="down" />
			{OPTIONS.map((o) => (
				<Pressable
					key={o.seconds}
					style={({ pressed }) => [
						styles.option,
						pressed && styles.optionPressed,
					]}
					onPress={() => onPickDuration(o.seconds)}
					accessibilityRole="button"
					accessibilityLabel={`Start ${o.label} hourglass`}
				>
					<Text style={[styles.label, { color: theme.text }]}>
						{o.label}
					</Text>
				</Pressable>
			))}
			<Pressable
				style={({ pressed }) => [
					styles.option,
					pressed && styles.optionPressed,
				]}
				onPress={onPickCustom}
				accessibilityRole="button"
				accessibilityLabel="Choose a custom duration"
			>
				<Text style={[styles.label, { color: theme.text }]}>
					Custom
				</Text>
			</Pressable>
			<Pressable
				style={({ pressed }) => [
					styles.option,
					pressed && styles.optionPressed,
				]}
				onPress={onPickChess}
				accessibilityRole="button"
				accessibilityLabel="Start chess clock"
			>
				<Text style={[styles.label, { color: theme.accent }]}>Chess</Text>
			</Pressable>
			<EdgeShadow direction="up" />
			<View style={styles.feedbackRow}>
				<Pressable
					onPress={() => toggle('sound')}
					hitSlop={12}
					accessibilityRole="switch"
					accessibilityState={{ checked: settings.sound }}
					accessibilityLabel="Sound"
				>
					<Text
						style={[
							styles.feedback,
							{ color: settings.sound ? theme.dim : theme.faint },
							!settings.sound && styles.feedbackOff,
						]}
					>
						Sound
					</Text>
				</Pressable>
				<Pressable
					onPress={cycleTheme}
					hitSlop={12}
					accessibilityRole="button"
					accessibilityLabel={`Theme: ${THEME_LABEL[settings.themeMode]}. Tap to change.`}
				>
					<Text style={[styles.feedback, { color: theme.dim }]}>
						{THEME_LABEL[settings.themeMode]}
					</Text>
				</Pressable>
				<Pressable
					onPress={() => toggle('haptics')}
					hitSlop={12}
					accessibilityRole="switch"
					accessibilityState={{ checked: settings.haptics }}
					accessibilityLabel="Haptics"
				>
					<Text
						style={[
							styles.feedback,
							{
								color: settings.haptics
									? theme.dim
									: theme.faint,
							},
							!settings.haptics && styles.feedbackOff,
						]}
					>
						Haptics
					</Text>
				</Pressable>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	root: {
		flex: 1,
	},
	wordmark: {
		textAlign: 'center',
		fontSize: 11,
		fontWeight: '300',
		letterSpacing: 8,
		textTransform: 'uppercase',
		paddingTop: 20,
		paddingBottom: 16,
	},
	option: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
	},
	optionPressed: {
		opacity: 0.55,
		transform: [{ scale: 0.97 }],
	},
	label: {
		fontSize: 28,
		fontWeight: '200',
		letterSpacing: 5,
		textTransform: 'uppercase',
	},
	feedbackRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 32,
		paddingVertical: 18,
	},
	feedback: {
		fontSize: 11,
		letterSpacing: 3,
		textTransform: 'uppercase',
	},
	feedbackOff: {
		textDecorationLine: 'line-through',
	},
});
