module.exports.clearMessageSchedule = (messageName) => {
    clearInterval(message_schedules[messageName]);
    message_schedules[messageName] = undefined;
    message_schedules_info[messageName] = undefined;
    clearInterval(resetMessageInterval);
    reset_message_intervals[messageName] = undefined;
}

module.exports.clearAllMessageSchedules = () => {
    Object.entries(message_schedules).forEach(([key, value]) => {
        clearInterval(value);
        message_schedules[key] = undefined;
    });
    Object.entries(reset_message_intervals).forEach(([key, value]) => {
        clearInterval(value);
        reset_message_intervals[key] = undefined;
    });

    Object.entries(message_schedules_info).forEach(([key, value]) => {
        message_schedules_info[key] = undefined;
    });
}