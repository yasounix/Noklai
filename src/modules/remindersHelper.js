/**
 * Noklai Reminders Helper
 * Time-based logic, categorization, sorting, and daily reset handlers.
 */

export const REMINDER_CATEGORIES = [
  {
    id: 'Medication',
    key: 'Medication',
    label: 'Medication',
    icon: 'medkit',
    color: '#DC2626',
    badgeBg: '#FEE2E2',
    dotColor: '#EF4444',
  },
  {
    id: 'Meal',
    key: 'Meal',
    label: 'Meal & Nutrition',
    icon: 'restaurant',
    color: '#D97706',
    badgeBg: '#FEF3C7',
    dotColor: '#F59E0B',
  },
  {
    id: 'Hydration',
    key: 'Hydration',
    label: 'Water & Drink',
    icon: 'water',
    color: '#0284C7',
    badgeBg: '#E0F2FE',
    dotColor: '#0EA5E9',
  },
  {
    id: 'Exercise',
    key: 'Exercise',
    label: 'Walk & Activity',
    icon: 'walk',
    color: '#16A34A',
    badgeBg: '#DCFCE7',
    dotColor: '#22C55E',
  },
  {
    id: 'Health',
    key: 'Health',
    label: 'Health Check',
    icon: 'heart',
    color: '#9333EA',
    badgeBg: '#F3E8FF',
    dotColor: '#A855F7',
  },
  {
    id: 'Routine',
    key: 'Routine',
    label: 'Daily Routine',
    icon: 'alarm',
    color: '#4F46E5',
    badgeBg: '#EEF2FF',
    dotColor: '#6366F1',
  },
];

REMINDER_CATEGORIES.forEach((cat) => {
  REMINDER_CATEGORIES[cat.id] = cat;
});

export const REMINDER_CATEGORIES_MAP = REMINDER_CATEGORIES.reduce((acc, cat) => {
  acc[cat.id] = cat;
  return acc;
}, {});

export const getCategoryMeta = (category) => {
  if (!category) return REMINDER_CATEGORIES.Routine;
  const catLower = String(category).toLowerCase();
  const match = REMINDER_CATEGORIES.find(
    (c) => c.key.toLowerCase() === catLower || c.label.toLowerCase() === catLower || c.id.toLowerCase() === catLower
  );
  return match || REMINDER_CATEGORIES.Routine;
};

/**
 * Parses time string like "08:30 AM", "8:30 am", "14:30", "2:00 PM"
 * returns minutes from midnight (0 - 1439), or -1 if invalid
 */
export const parseTimeToMinutes = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string') return -1;
  const clean = timeStr.trim().toUpperCase();

  // Match "HH:MM AM/PM" or "HH:MM"
  const ampmMatch = clean.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1], 10);
    const minutes = parseInt(ampmMatch[2], 10);
    const meridian = ampmMatch[3];

    if (meridian === 'PM' && hours < 12) hours += 12;
    if (meridian === 'AM' && hours === 12) hours = 0;

    return hours * 60 + minutes;
  }

  // Match "H AM/PM" like "8 AM" or "8 PM"
  const hourOnlyMatch = clean.match(/^(\d{1,2})\s*(AM|PM)$/i);
  if (hourOnlyMatch) {
    let hours = parseInt(hourOnlyMatch[1], 10);
    const meridian = hourOnlyMatch[2];
    if (meridian === 'PM' && hours < 12) hours += 12;
    if (meridian === 'AM' && hours === 12) hours = 0;
    return hours * 60;
  }

  return -1;
};

/**
 * Formats a Date object to YYYY-MM-DD
 */
export const formatDateKey = (d) => {
  const date = d || new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Formats hours/minutes to "hh:mm AM/PM"
 */
export const formatMinutesToDisplay = (totalMinutes) => {
  if (totalMinutes < 0) return '12:00 PM';
  const hours24 = Math.floor(totalMinutes / 60) % 24;
  const mins = totalMinutes % 60;
  const meridian = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${String(hours12).padStart(2, '0')}:${String(mins).padStart(2, '0')} ${meridian}`;
};

/**
 * Calculates dynamic time-based status for a reminder.
 * Possible statuses:
 * - 'completed': already marked done
 * - 'due_now': scheduled within [-15m, +30m] of current time today
 * - 'overdue': scheduled > 30m ago today or past date
 * - 'upcoming': scheduled in the future
 */
export const getReminderStatus = (reminder, now = new Date()) => {
  if (!reminder) {
    return {
      status: 'upcoming',
      label: 'Upcoming',
      color: '#2563EB',
      badgeBg: '#EFF6FF',
      icon: 'time-outline',
    };
  }

  // Completed check
  if (reminder.completed || reminder.done) {
    return {
      status: 'completed',
      label: 'Completed',
      color: '#16A34A',
      badgeBg: '#DCFCE7',
      icon: 'checkmark-circle',
    };
  }

  const todayStr = formatDateKey(now);
  const reminderDateStr = reminder.date ? reminder.date.trim() : todayStr;

  // Date comparison
  if (reminderDateStr < todayStr) {
    return {
      status: 'overdue',
      label: 'Overdue',
      color: '#DC2626',
      badgeBg: '#FEE2E2',
      icon: 'alert-circle',
    };
  }

  if (reminderDateStr > todayStr) {
    return {
      status: 'upcoming',
      label: 'Upcoming',
      color: '#2563EB',
      badgeBg: '#EFF6FF',
      icon: 'calendar-outline',
    };
  }

  // Date is today: check time of day
  const targetMinutes = parseTimeToMinutes(reminder.time);
  if (targetMinutes === -1) {
    return {
      status: 'upcoming',
      label: 'Upcoming',
      color: '#2563EB',
      badgeBg: '#EFF6FF',
      icon: 'time-outline',
    };
  }

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const diffMinutes = currentMinutes - targetMinutes;

  // Between 15 mins before and 30 mins after -> Due Now
  if (diffMinutes >= -15 && diffMinutes <= 30) {
    return {
      status: 'due_now',
      label: 'Due Now',
      color: '#EA580C',
      badgeBg: '#FFEDD5',
      icon: 'alarm',
    };
  }

  // More than 30 minutes in the past -> Overdue
  if (diffMinutes > 30) {
    return {
      status: 'overdue',
      label: 'Overdue',
      color: '#DC2626',
      badgeBg: '#FEE2E2',
      icon: 'alert-circle',
    };
  }

  // Future today (> 15 mins away) -> Upcoming
  return {
    status: 'upcoming',
    label: 'Upcoming',
    color: '#2563EB',
    badgeBg: '#EFF6FF',
    icon: 'time-outline',
  };
};

/**
 * Checks if a daily reminder was completed on a previous day,
 * and if so resets its completed state for today.
 */
export const checkAndResetDailyReminders = (reminders, now = new Date()) => {
  if (!Array.isArray(reminders)) return [];
  const todayStr = formatDateKey(now);

  return reminders.map((r) => {
    // If not completed, nothing to reset
    if (!r.completed && !r.done) return r;

    // If it has a specific future or past date other than today/empty, don't reset
    if (r.date && r.date !== todayStr) return r;

    // Check completion timestamp
    if (r.completed_at) {
      try {
        const compDate = new Date(r.completed_at);
        const compDateStr = formatDateKey(compDate);
        if (compDateStr < todayStr) {
          // Completed on an earlier day, reset for today!
          return {
            ...r,
            completed: false,
            done: false,
            completed_at: null,
          };
        }
      } catch (e) {
        // Keep as is
      }
    }

    return r;
  });
};

/**
 * Sorts reminders by urgency:
 * 1. Due Now (urgent)
 * 2. Overdue (needs attention)
 * 3. Upcoming (ordered by scheduled time)
 * 4. Completed (bottom)
 */
export const sortReminders = (reminders, now = new Date()) => {
  if (!Array.isArray(reminders)) return [];

  const evaluated = reminders.map((r) => ({
    ...r,
    _statusMeta: getReminderStatus(r, now),
    _minutes: parseTimeToMinutes(r.time),
  }));

  const rank = {
    due_now: 1,
    overdue: 2,
    upcoming: 3,
    completed: 4,
  };

  return evaluated.sort((a, b) => {
    const rankA = rank[a._statusMeta.status] || 5;
    const rankB = rank[b._statusMeta.status] || 5;

    if (rankA !== rankB) {
      return rankA - rankB;
    }

    // Within same rank, sort by time
    if (a._minutes !== -1 && b._minutes !== -1) {
      return a._minutes - b._minutes;
    }

    return (a.title || '').localeCompare(b.title || '');
  });
};

/**
 * Calculates counts for caregiver header summary
 */
export const getReminderStats = (reminders, now = new Date()) => {
  if (!Array.isArray(reminders) || reminders.length === 0) {
    return {
      total: 0,
      completed: 0,
      pending: 0,
      dueNow: 0,
      overdue: 0,
      upcoming: 0,
    };
  }

  let completed = 0;
  let dueNow = 0;
  let overdue = 0;
  let upcoming = 0;

  reminders.forEach((r) => {
    const { status } = getReminderStatus(r, now);
    if (status === 'completed') completed += 1;
    else if (status === 'due_now') dueNow += 1;
    else if (status === 'overdue') overdue += 1;
    else upcoming += 1;
  });

  return {
    total: reminders.length,
    completed,
    pending: reminders.length - completed,
    dueNow,
    overdue,
    upcoming,
  };
};
