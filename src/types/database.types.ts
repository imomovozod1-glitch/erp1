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
      }
      customers: {
        Row: {
          id: string
          name: string
          email: string | null
          phone: string | null
          address: string | null
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
          tin?: string | null
          notes?: string | null
          is_active?: boolean
        }
        Update: {
          name?: string
          email?: string | null
          phone?: string | null
          address?: string | null
          tin?: string | null
          notes?: string | null
          is_active?: boolean
        }
      }
      suppliers: {
        Row: {
          id: string
          name: string
          email: string | null
          phone: string | null
          address: string | null
          city: string | null
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
          tin?: string | null
          contact_person?: string | null
          notes?: string | null
          is_active?: boolean
        }
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
          transaction_date?: string
          created_by: string
        }
        Update: {
          amount?: number
          category?: string
          description?: string | null
          transaction_date?: string
        }
      }
    }
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
