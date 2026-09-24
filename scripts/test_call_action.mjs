import assert from 'node:assert/strict';

const normalizeIndianPhone = (phone) => {
	if (!phone || typeof phone !== 'string') return null;
	let cleaned = phone.trim().replace(/[\s\-\(\)\.\,\/]/g, '');
	if (cleaned.startsWith('+')) cleaned = cleaned.substring(1);
	if (cleaned.length === 12 && cleaned.startsWith('91')) cleaned = cleaned.substring(2);
	if (cleaned.length === 11 && cleaned.startsWith('0')) cleaned = cleaned.substring(1);
	return /^[6-9]\d{9}$/.test(cleaned) ? cleaned : null;
};

const getCallNumber = (role, patientPhone, caregiverPhone) => {
	const phone = role === 'caregiver' ? patientPhone : caregiverPhone;
	const normalized = normalizeIndianPhone(phone);
	return normalized ? `+91${normalized}` : null;
};

const getTelUrl = (phone) => {
	const normalized = normalizeIndianPhone(phone);
	return normalized ? `tel:+91${normalized}` : null;
};

assert.equal(getCallNumber('caregiver', '+91 98765 43210', '+91 91234 56789'), '+919876543210');
assert.equal(getCallNumber('patient', '+91 98765 43210', '+91 91234 56789'), '+919123456789');
assert.equal(getCallNumber('caregiver', '', '+91 91234 56789'), null);
assert.equal(getCallNumber('patient', '+91 98765 43210', 'not-a-number'), null);
assert.equal(getTelUrl('+91 98765 43210'), 'tel:+919876543210');
assert.equal(getTelUrl('not-a-number'), null);

console.log('Call action tests passed.');
