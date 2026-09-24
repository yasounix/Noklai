import { Linking, Platform } from 'react-native';
import { normalizeIndianPhone } from './phoneValidation';

export function getCallTargetPhone(role, patientPhone, caregiverPhone) {
	return role === 'caregiver' ? patientPhone : caregiverPhone;
}

export function getCallNumber(role, patientPhone, caregiverPhone) {
	const normalized = normalizeIndianPhone(
		getCallTargetPhone(role, patientPhone, caregiverPhone)
	);

	return normalized ? `+91${normalized}` : null;
}

export function getTelUrl(phone) {
	const normalized = normalizeIndianPhone(phone);
	return normalized ? `tel:+91${normalized}` : null;
}

export async function callPhone(phone) {
	const telUrl = getTelUrl(phone);
	if (!telUrl) return false;

	if (Platform.OS === 'web' && typeof window !== 'undefined') {
		window.location.href = telUrl;
	} else {
		await Linking.openURL(telUrl);
	}
	return true;
}
