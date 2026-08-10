export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string
          email: string
          role: 'admin' | 'manager' | 'staff'
          avatar_url: string | null
          phone: string | null
          is_active: boolean
          department_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name: string
          email: string
          role?: 'admin' | 'manager' | 'staff'
          avatar_url?: string | null
          phone?: string | null
          is_active?: boolean
          department_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          full_name?: string
          email?: string
          role?: 'admin' | 'manager' | 'staff'
          avatar_url?: string | null
          phone?: string | null
          is_active?: boolean
          department_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_profiles_department"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          }
        ]
      }
      departments: {
        Row: {
          id: string
          name: string
          description: string | null
          manager_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          manager_id?: string | null
        }
        Update: {
          name?: string
          description?: string | null
          manager_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "departments_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      employees: {
        Row: {
          id: string
          profile_id: string | null
          employee_code: string
          position: string
          salary: number
          hired_at: string
          terminated_at: string | null
          is_active: boolean
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          profile_id?: string | null
          employee_code: string
          position: string
          salary?: number
          hired_at: string
          terminated_at?: string | null
          is_active?: boolean
          notes?: string | null
        }
        Update: {
          position?: string
          salary?: number
          hired_at?: string
          terminated_at?: string | null
          is_active?: boolean
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      categories: {
        Row: {
          id: string
          name: string
          slug: string
          parent_id: string | null
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          parent_id?: string | null
          description?: string | null
        }
        Update: {
          name?: string
          slug?: string
          parent_id?: string | null
          description?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          }
        ]
      }
      products: {
        Row: {
          id: string
          name: string
          sku: string
          description: string | null
          category_id: string | null
          unit: string
          price: number
          cost_price: number
          incoming_cost: number
          stock: number
          min_stock: number
          max_stock: number | null
          image_url: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          sku: string
          description?: string | null
          category_id?: string | null
          unit?: string
          price?: number
          cost_price?: number
          incoming_cost?: number
          stock?: number
          min_stock?: number
          max_stock?: number | null
          image_url?: string | null
          is_active?: boolean
        }
        Update: {
          name?: string
          sku?: string
          description?: string | null
          category_id?: string | null
          unit?: string
          price?: number
          cost_price?: number
          incoming_cost?: number
          stock?: number
          min_stock?: number
          max_stock?: number | null
          image_url?: string | null
          is_active?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          }
        ]
      }
      customers: {
        Row: {
          id: string
          name: string
          email: string | null
          phone: string | null
          address: string | null
          latitude: number | null
          longitude: number | null
          tin: string | null
          notes: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          email?: string | null
          phone?: string | null
          address?: string | null
          latitude?: number | null
          longitude?: number | null
          tin?: string | null
          notes?: string | null
          is_active?: boolean
        }
        Update: {
          name?: string
          email?: string | null
          phone?: string | null
          address?: string | null
          latitude?: number | null
          longitude?: number | null
          tin?: string | null
          notes?: string | null
          is_active?: boolean
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          id: string
          name: string
          email: string | null
          phone: string | null
          address: string | null
          city: string | null
          latitude: number | null
          longitude: number | null
          tin: string | null
          contact_person: string | null
          notes: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          email?: string | null
          phone?: string | null
          address?: string | null
          city?: string | null
          latitude?: number | null
          longitude?: number | null
          tin?: string | null
          contact_person?: string | null
          notes?: string | null
          is_active?: boolean
        }
        Update: {
          name?: string
          email?: string | null
          phone?: string | null
          address?: string | null
          city?: string | null
          latitude?: number | null
          longitude?: number | null
          tin?: string | null
          contact_person?: string | null
          notes?: string | null
          is_active?: boolean
        }
        Relationships: []
      }
      sales_orders: {
        Row: {
          id: string
          order_number: string
          customer_id: string | null
          status: 'draft' | 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled'
          total_amount: number
          discount_amount: number
          tax_amount: number
          notes: string | null
          created_by: string
          order_date: string
          delivery_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          order_number: string
          customer_id?: string | null
          status?: 'draft' | 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled'
          total_amount?: number
          discount_amount?: number
          tax_amount?: number
          notes?: string | null
          created_by: string
          order_date?: string
          delivery_date?: string | null
        }
        Update: {
          status?: 'draft' | 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled'
          total_amount?: number
          discount_amount?: number
          tax_amount?: number
          notes?: string | null
          delivery_date?: string | null
          customer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      sales_order_items: {
        Row: {
          id: string
          order_id: string
          product_id: string
          quantity: number
          unit_price: number
          discount_percent: number
          total_price: number
          created_at: string
        }
        Insert: {
          id?: string
          order_id: string
          product_id: string
          quantity: number
          unit_price: number
          discount_percent?: number
          total_price: number
        }
        Update: {
          quantity?: number
          unit_price?: number
          discount_percent?: number
          total_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          }
        ]
      }
      invoices: {
        Row: {
          id: string
          invoice_number: string
          order_id: string | null
          customer_id: string | null
          status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
          total_amount: number
          paid_amount: number
          issued_at: string
          due_at: string
          paid_at: string | null
          image_url: string | null
          notes: string | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          invoice_number: string
          order_id?: string | null
          customer_id?: string | null
          status?: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
          total_amount?: number
          paid_amount?: number
          issued_at?: string
          due_at: string
          paid_at?: string | null
          image_url?: string | null
          notes?: string | null
          created_by: string
        }
        Update: {
          status?: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
          paid_amount?: number
          due_at?: string
          paid_at?: string | null
          image_url?: string | null
          notes?: string | null
          customer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      purchase_orders: {
        Row: {
          id: string
          po_number: string
          supplier_id: string
          status: 'draft' | 'sent' | 'received' | 'partially_received' | 'cancelled'
          total_amount: number
          notes: string | null
          created_by: string
          order_date: string
          expected_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          po_number: string
          supplier_id: string
          status?: 'draft' | 'sent' | 'received' | 'partially_received' | 'cancelled'
          total_amount?: number
          notes?: string | null
          created_by: string
          order_date?: string
          expected_date?: string | null
        }
        Update: {
          status?: 'draft' | 'sent' | 'received' | 'partially_received' | 'cancelled'
          total_amount?: number
          notes?: string | null
          expected_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      purchase_order_items: {
        Row: {
          id: string
          po_id: string
          product_id: string
          quantity: number
          unit_cost: number
          received_qty: number
          total_cost: number
          created_at: string
        }
        Insert: {
          id?: string
          po_id: string
          product_id: string
          quantity: number
          unit_cost: number
          received_qty?: number
          total_cost: number
        }
        Update: {
          received_qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          }
        ]
      }
      stock_movements: {
        Row: {
          id: string
          product_id: string
          type: 'in' | 'out' | 'adjustment'
          quantity: number
          quantity_before: number
          quantity_after: number
          reference_type: string | null
          reference_id: string | null
          reason: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          product_id: string
          type: 'in' | 'out' | 'adjustment'
          quantity: number
          quantity_before: number
          quantity_after: number
          reference_type?: string | null
          reference_id?: string | null
          reason?: string | null
          created_by?: string | null
        }
        Update: never
        Relationships: [
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      transactions: {
        Row: {
          id: string
          type: 'income' | 'expense'
          amount: number
          category: string
          description: string | null
          reference_type: string | null
          reference_id: string | null
          employee_id: string | null
          supplier_id: string | null
          transaction_date: string
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          type: 'income' | 'expense'
          amount: number
          category: string
          description?: string | null
          reference_type?: string | null
          reference_id?: string | null
          employee_id?: string | null
          supplier_id?: string | null
          transaction_date?: string
          created_by: string
        }
        Update: {
          amount?: number
          category?: string
          description?: string | null
          transaction_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      user_role: 'admin' | 'manager' | 'staff'
      order_status: 'draft' | 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled'
      invoice_status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
      transaction_type: 'income' | 'expense'
      stock_movement_type: 'in' | 'out' | 'adjustment'
      purchase_order_status: 'draft' | 'sent' | 'received' | 'partially_received' | 'cancelled'
    }
  }
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type Inserts<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type Updates<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T]

// Convenient type aliases
export type Profile = Tables<'profiles'>
export type Department = Tables<'departments'>
export type Employee = Tables<'employees'>
export type Category = Tables<'categories'>
export type Product = Tables<'products'>
export type Customer = Tables<'customers'>
export type Supplier = Tables<'suppliers'>
export type SalesOrder = Tables<'sales_orders'>
export type SalesOrderItem = Tables<'sales_order_items'>
export type Invoice = Tables<'invoices'>
export type PurchaseOrder = Tables<'purchase_orders'>
export type PurchaseOrderItem = Tables<'purchase_order_items'>
export type StockMovement = Tables<'stock_movements'>
export type Transaction = Tables<'transactions'>
