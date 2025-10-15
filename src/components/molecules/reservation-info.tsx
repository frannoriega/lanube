export function ReservationInfo({
  user,
  startTime,
  endTime,
  createdAt,
  reason,
}: {
  user: { email: string; dni: string; institution: string | null };
  startTime: string;
  endTime: string;
  createdAt: string;
  reason: string;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
      <div>
        <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Información del Usuario</p>
        <p className="text-sm">Email: {user.email}</p>
        <p className="text-sm">DNI: {user.dni}</p>
        {user.institution && <p className="text-sm">Institución: {user.institution}</p>}
      </div>
      <div>
        <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Detalles de la Reserva</p>
        <p className="text-sm">
          {new Date(startTime).toLocaleDateString()} -
          {new Date(startTime).toLocaleTimeString()} a
          {new Date(endTime).toLocaleTimeString()}
        </p>
        <p className="text-sm">
          Creada: {new Date(createdAt).toLocaleDateString()} a las {new Date(createdAt).toLocaleTimeString()}
        </p>
      </div>
      <div className="md:col-span-2">
        <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Motivo de la reserva:</p>
        <p className="text-sm bg-gray-50 p-3 rounded-lg">{reason}</p>
      </div>
    </div>
  );
}


