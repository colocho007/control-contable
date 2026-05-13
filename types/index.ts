export type Estado = "Pendiente" | "Completado";
export type Prioridad = "Alta" | "Media" | "Baja";

export interface Tarea {
  id: number;
  nombre: string;
  estado: Estado;
  empleado: string;
  usuario_id: string;
  empresa: string;
  fecha_limite?: string;
  prioridad: Prioridad;
  archivo?: string;
}

export interface TareaRowProps {
  tarea: Tarea;
  rol: string;
  isProcessing: boolean;
  onCompletar: (id: number) => Promise<void>;
  onEliminar: (id: number) => Promise<void>;
  onFileChange: (id: number, file: File) => void;
}

export interface Perfil { id: string; nombre: string; rol: string; }
export interface Empresa { id: number; nombre: string; }
