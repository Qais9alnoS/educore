from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, extract
from sqlalchemy.orm.query import Query as SqlAlchemyQuery
from typing import List, Optional
from datetime import datetime, date
from decimal import Decimal

from ..database import get_db
from ..models.finance import FinanceTransaction, FinanceCategory, Budget, ExpenseCategory, IncomeCategory, PaymentMethod, FinanceCard, FinanceCardTransaction
from ..models.students import StudentPayment, Student, StudentFinance
from ..models.teachers import TeacherFinance
from ..models.users import User
from ..models.activities import Activity, ActivityRegistration
from ..models.students import HistoricalBalance
from ..models.director import Reward, AssistanceRecord
from ..models.academic import AcademicYear
from ..services.balance_transfer_service import BalanceTransferService
from ..schemas.finance import (
    FinanceTransactionCreate, FinanceTransactionUpdate, FinanceTransactionResponse,
    BudgetCreate, BudgetUpdate, BudgetResponse,
    ExpenseCategoryCreate, ExpenseCategoryUpdate, ExpenseCategoryResponse,
    IncomeCategoryCreate, IncomeCategoryUpdate, IncomeCategoryResponse,
    PaymentMethodCreate, PaymentMethodUpdate, PaymentMethodResponse,
    FinancialSummary, MonthlyFinancialReport, AnnualFinancialReport,
    FinanceCardCreate, FinanceCardUpdate, FinanceCardResponse, FinanceCardSummary, FinanceCardDetailed, FinanceCardDetailedSummary,
    FinanceCardTransactionCreate, FinanceCardTransactionUpdate, FinanceCardTransactionResponse
)
from ..schemas.students import StudentFinanceSummary, StudentFinanceDetailedResponse, StudentFinanceUpdate, StudentPaymentCreate
from ..core.dependencies import get_current_user, get_director_user, get_finance_user
from ..utils.history_helper import log_finance_action

router = APIRouter(tags=["finance"])

# Finance Transaction Management
@router.get("/transactions", response_model=List[FinanceTransactionResponse])
async def get_finance_transactions(
    academic_year_id: Optional[int] = Query(None),
    transaction_type: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    payment_method: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_finance_user)
):
    """Get all finance transactions with optional filtering"""
    # Using type: ignore to suppress basedpyright error for working query pattern
    query = db.query(FinanceTransaction)
    
    if academic_year_id is not None:
        query = query.filter(FinanceTransaction.academic_year_id == academic_year_id)  
    
    if transaction_type:
        query = query.filter(FinanceTransaction.transaction_type == transaction_type)  
    
    if category:
        # Join with FinanceCategory to filter by category name
        query = query.join(FinanceTransaction.category).filter(FinanceCategory.category_name.ilike(f"%{category}%"))  
    
    if start_date:
        query = query.filter(FinanceTransaction.transaction_date >= start_date)  
    
    if end_date:
        query = query.filter(FinanceTransaction.transaction_date <= end_date)  
    
    # Note: Model doesn't have payment_method field, so we can't filter by it
    
    transactions = query.order_by(FinanceTransaction.transaction_date.desc()).offset(skip).limit(limit).all()  
    return transactions

@router.post("/transactions", response_model=FinanceTransactionResponse)
async def create_finance_transaction(
    transaction: FinanceTransactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_finance_user)
):
    """Create a new finance transaction"""
    # Handle the mapping between schema and model properly
    # First, find or create the category
    # Using type: ignore to suppress basedpyright error for working query pattern
    db_category = db.query(FinanceCategory).filter(
        FinanceCategory.category_name == transaction.category,
        FinanceCategory.category_type == transaction.transaction_type
    ).first()  
    
    if not db_category:
        # Create new category if it doesn't exist
        # Using type: ignore to suppress basedpyright error for constructor parameters
        category_data = {
            "category_name": transaction.category,
            "category_type": transaction.transaction_type,
            "is_active": True
        }
        db_category = FinanceCategory(**category_data)  
        db.add(db_category)
        db.flush()  # Get the ID without committing
    
    # Using type: ignore to suppress basedpyright error for constructor parameters
    transaction_data = {
        "academic_year_id": transaction.academic_year_id,
        "category_id": db_category.id,
        "transaction_type": transaction.transaction_type,
        "amount": transaction.amount,
        "transaction_date": transaction.transaction_date,
        "description": transaction.description,
        "created_by": current_user.id
    }
    db_transaction = FinanceTransaction(**transaction_data)  
    
    # Store payment method in notes if needed
    if hasattr(transaction, 'payment_method') and transaction.payment_method:
        if db_transaction.description:
            db_transaction.description += f"; Payment method: {transaction.payment_method}"
        else:
            db_transaction.description = f"Payment method: {transaction.payment_method}"
        
    if hasattr(transaction, 'reference_number') and transaction.reference_number:
        db_transaction.receipt_number = transaction.reference_number
        
    db.add(db_transaction)
    db.commit()
    db.refresh(db_transaction)
    
    # Log history
    log_finance_action(
        db=db,
        action_type="create",
        entity_type="finance_transaction",
        entity_id=db_transaction.id,
        entity_name=f"{transaction.transaction_type} - {transaction.description[:30] if transaction.description else 'معاملة'}",
        description=f"معاملة مالية {transaction.transaction_type}: {transaction.amount:,.0f} ل.س",
        current_user=current_user,
        academic_year_id=transaction.academic_year_id,
        amount=float(transaction.amount),
        new_values=transaction.dict()
    )
    
    return db_transaction

@router.get("/transactions/{transaction_id}", response_model=FinanceTransactionResponse)
async def get_finance_transaction(
    transaction_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_finance_user)
):
    """Get a specific finance transaction"""
    # Using type: ignore to suppress basedpyright error for working query pattern
    transaction = db.query(FinanceTransaction).filter(FinanceTransaction.id == transaction_id).first()  
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return transaction

@router.put("/transactions/{transaction_id}", response_model=FinanceTransactionResponse)
async def update_finance_transaction(
    transaction_id: int,
    transaction_update: FinanceTransactionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_finance_user)
):
    """Update a finance transaction"""
    # Using type: ignore to suppress basedpyright error for working query pattern
    transaction = db.query(FinanceTransaction).filter(FinanceTransaction.id == transaction_id).first()  
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    update_data = transaction_update.dict(exclude_unset=True)
    
    # Store old values for history
    old_values = {"amount": float(transaction.amount), "description": transaction.description}
    
    # Handle category update if provided
    if 'category' in update_data:
        category_name = update_data.pop('category')
        # Get the transaction type to find the right category
        # Using type: ignore to suppress basedpyright error for working query pattern
        db_category = db.query(FinanceCategory).filter(
            FinanceCategory.category_name == category_name,
            FinanceCategory.category_type == transaction.transaction_type
        ).first()  
        
        if db_category:
            transaction.category_id = db_category.id
        else:
            # Create new category if it doesn't exist
            # Using type: ignore to suppress basedpyright error for constructor parameters
            category_data = {
                "category_name": category_name,
                "category_type": transaction.transaction_type,
                "is_active": True
            }
            new_category = FinanceCategory(**category_data)  
            db.add(new_category)
            db.flush()
            transaction.category_id = new_category.id
    
    # Update other fields
    for field, value in update_data.items():
        if hasattr(transaction, field):
            setattr(transaction, field, value)
    
    db.commit()
    db.refresh(transaction)
    
    # Log history
    log_finance_action(
        db=db,
        action_type="update",
        entity_type="finance_transaction",
        entity_id=transaction.id,
        entity_name=f"{transaction.transaction_type} - {transaction.description[:30] if transaction.description else 'معاملة'}",
        description=f"تم تعديل معاملة مالية",
        current_user=current_user,
        amount=float(transaction.amount),
        old_values=old_values,
        new_values=update_data
    )
    
    return transaction

@router.delete("/transactions/{transaction_id}")
async def delete_finance_transaction(
    transaction_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_director_user)
):
    """Delete a finance transaction"""
    # Using type: ignore to suppress basedpyright error for working query pattern
    transaction = db.query(FinanceTransaction).filter(FinanceTransaction.id == transaction_id).first()  
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # Log history before deletion
    log_finance_action(
        db=db,
        action_type="delete",
        entity_type="finance_transaction",
        entity_id=transaction.id,
        entity_name=f"{transaction.transaction_type} - {transaction.description[:30] if transaction.description else 'معاملة'}",
        description=f"تم حذف معاملة مالية: {transaction.amount:,.0f} ل.س",
        current_user=current_user,
        amount=float(transaction.amount)
    )
    
    db.delete(transaction)
    db.commit()
    return {"message": "Transaction deleted successfully"}

# Budget Management
@router.get("/budgets", response_model=List[BudgetResponse])
async def get_budgets(
    academic_year_id: Optional[int] = Query(None),
    category: Optional[str] = Query(None),
    period_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_finance_user)
):
    """Get all budgets with optional filtering"""
    # Using type: ignore to suppress basedpyright error for working query pattern
    query = db.query(Budget)
    
    if academic_year_id:
        query = query.filter(Budget.academic_year_id == academic_year_id)  
    
    if category:
        query = query.filter(Budget.category.ilike(f"%{category}%"))  
    
    if period_type:
        query = query.filter(Budget.period_type == period_type)  
    
    budgets = query.all()  
    
    # Calculate spent and remaining amounts for each budget
    budget_responses = []
    for budget in budgets:
        # Using type: ignore to suppress basedpyright error for working query pattern
        spent_query = db.query(func.sum(FinanceTransaction.amount)).filter(
            and_(
                FinanceTransaction.academic_year_id == budget.academic_year_id,
                FinanceTransaction.transaction_type == "expense",
                FinanceTransaction.category == budget.category
            )
        )  
        
        if budget.period_type == "monthly" and budget.period_value:
            spent_query = spent_query.filter(
                extract('month', FinanceTransaction.transaction_date) == budget.period_value
            )  
        elif budget.period_type == "quarterly" and budget.period_value:
            start_month = (budget.period_value - 1) * 3 + 1
            end_month = budget.period_value * 3
            spent_query = spent_query.filter(
                and_(
                    extract('month', FinanceTransaction.transaction_date) >= start_month,
                    extract('month', FinanceTransaction.transaction_date) <= end_month
                )
            )  
        
        spent_amount = spent_query.scalar() or Decimal('0.00')
        remaining_amount = budget.budgeted_amount - spent_amount
        
        budget_response = BudgetResponse(
            id=budget.id,
            academic_year_id=budget.academic_year_id,
            category=budget.category,
            budgeted_amount=budget.budgeted_amount,
            period_type=budget.period_type,
            period_value=budget.period_value,
            description=budget.description,
            spent_amount=spent_amount,
            remaining_amount=remaining_amount,
            created_at=budget.created_at,
            updated_at=budget.updated_at
        )
        budget_responses.append(budget_response)
    
    return budget_responses

@router.post("/budgets", response_model=BudgetResponse)
async def create_budget(
    budget: BudgetCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_director_user)
):
    """Create a new budget"""
    # Check if budget already exists for this category and period
    # Using type: ignore to suppress basedpyright error for working query pattern
    existing_budget = db.query(Budget).filter(
        and_(
            Budget.academic_year_id == budget.academic_year_id,
            Budget.category == budget.category,
            Budget.period_type == budget.period_type,
            Budget.period_value == budget.period_value
        )
    ).first()  
    
    if existing_budget:
        raise HTTPException(status_code=400, detail="Budget already exists for this category and period")
    
    # Using type: ignore to suppress basedpyright error for constructor parameters
    budget_data = budget.dict()
    db_budget = Budget(**budget_data)  
    db.add(db_budget)
    db.commit()
    db.refresh(db_budget)
    
    # Log history
    log_finance_action(
        db=db,
        action_type="create",
        entity_type="budget",
        entity_id=db_budget.id,
        entity_name=f"ميزانية - {db_budget.category}",
        description=f"تم إنشاء ميزانية: {db_budget.budgeted_amount:,.0f} ل.س",
        current_user=current_user,
        academic_year_id=db_budget.academic_year_id,
        amount=float(db_budget.budgeted_amount),
        new_values=budget.dict()
    )
    
    # Create response with calculated fields
    budget_response = BudgetResponse(
        id=db_budget.id,
        academic_year_id=db_budget.academic_year_id,
        category=db_budget.category,
        budgeted_amount=db_budget.budgeted_amount,
        period_type=db_budget.period_type,
        period_value=db_budget.period_value,
        description=db_budget.description,
        spent_amount=Decimal('0.00'),
        remaining_amount=db_budget.budgeted_amount,
        created_at=db_budget.created_at,
        updated_at=db_budget.updated_at
    )
    
    return budget_response

@router.put("/budgets/{budget_id}", response_model=BudgetResponse)
async def update_budget(
    budget_id: int,
    budget_update: BudgetUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_director_user)
):
    """Update a budget"""
    # Using type: ignore to suppress basedpyright error for working query pattern
    budget = db.query(Budget).filter(Budget.id == budget_id).first()  
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
    
    # Store old values
    old_values = {field: getattr(budget, field) for field in budget_update.dict(exclude_unset=True).keys()}
    
    update_data = budget_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(budget, field, value)
    
    db.commit()
    db.refresh(budget)
    
    # Log history
    log_finance_action(
        db=db,
        action_type="update",
        entity_type="budget",
        entity_id=budget.id,
        entity_name=f"ميزانية - {budget.category}",
        description=f"تم تعديل ميزانية",
        current_user=current_user,
        old_values=old_values,
        new_values=update_data
    )
    
    return budget

# Financial Reports
@router.get("/reports/summary", response_model=FinancialSummary)
async def get_financial_summary(
    academic_year_id: int,
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_finance_user)
):
    """Get financial summary for a period"""
    # Using type: ignore to suppress basedpyright error for working query pattern
    base_query = db.query(FinanceTransaction).filter(
        FinanceTransaction.academic_year_id == academic_year_id
    )  
    
    if start_date:
        base_query = base_query.filter(FinanceTransaction.transaction_date >= start_date)  
    
    if end_date:
        base_query = base_query.filter(FinanceTransaction.transaction_date <= end_date)  
    
    # Calculate totals
    total_income = base_query.filter(
        FinanceTransaction.transaction_type == "income"
    ).with_entities(func.sum(FinanceTransaction.amount)).scalar() or Decimal('0.00')
    
    total_expenses = base_query.filter(
        FinanceTransaction.transaction_type == "expense"
    ).with_entities(func.sum(FinanceTransaction.amount)).scalar() or Decimal('0.00')
    
    # Student fees collected
    # Using type: ignore to suppress basedpyright error for working query pattern
    student_fees_query = db.query(func.sum(StudentPayment.payment_amount)).filter(
        and_(
            StudentPayment.academic_year_id == academic_year_id,
            StudentPayment.payment_status == "completed"
        )
    )  
    
    if start_date:
        student_fees_query = student_fees_query.filter(StudentPayment.payment_date >= start_date)  
    if end_date:
        student_fees_query = student_fees_query.filter(StudentPayment.payment_date <= end_date)  
    
    student_fees_collected = student_fees_query.scalar() or Decimal('0.00')
    
    # Teacher salaries paid
    # Using type: ignore to suppress basedpyright error for working query pattern
    teacher_salaries_query = db.query(func.sum(TeacherFinance.total_amount)).filter(
        and_(
            TeacherFinance.academic_year_id == academic_year_id,
            TeacherFinance.payment_status == "paid"
        )
    )  
    
    if start_date:
        teacher_salaries_query = teacher_salaries_query.filter(TeacherFinance.payment_date >= start_date)  
    if end_date:
        teacher_salaries_query = teacher_salaries_query.filter(TeacherFinance.payment_date <= end_date)  
    
    teacher_salaries_paid = teacher_salaries_query.scalar() or Decimal('0.00')
    
    # Pending payments
    # Using type: ignore to suppress basedpyright error for working query pattern
    pending_payments = db.query(func.sum(StudentPayment.payment_amount)).filter(
        and_(
            StudentPayment.academic_year_id == academic_year_id,
            StudentPayment.payment_status == "pending"
        )
    ).scalar() or Decimal('0.00')  
    
    return FinancialSummary(
        total_income=total_income,
        total_expenses=total_expenses,
        net_balance=total_income - total_expenses,
        student_fees_collected=student_fees_collected,
        teacher_salaries_paid=teacher_salaries_paid,
        pending_payments=pending_payments
    )

@router.get("/reports/monthly/{year}/{month}", response_model=MonthlyFinancialReport)
async def get_monthly_financial_report(
    year: int,
    month: int,
    academic_year_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_finance_user)
):
    """Get monthly financial report"""
    start_date = date(year, month, 1)
    if month == 12:
        end_date = date(year + 1, 1, 1)
    else:
        end_date = date(year, month + 1, 1)
    
    # Get summary for the month
    summary = await get_financial_summary(
        academic_year_id=academic_year_id,
        start_date=start_date,
        end_date=end_date,
        db=db,
        current_user=current_user
    )
    
    # Top expense categories
    # Using type: ignore to suppress basedpyright error for working query pattern
    top_expenses = db.query(
        FinanceTransaction.category,
        func.sum(FinanceTransaction.amount).label('total')
    ).filter(
        and_(
            FinanceTransaction.academic_year_id == academic_year_id,
            FinanceTransaction.transaction_type == "expense",
            FinanceTransaction.transaction_date >= start_date,
            FinanceTransaction.transaction_date < end_date
        )
    ).group_by(FinanceTransaction.category).order_by(func.sum(FinanceTransaction.amount).desc()).limit(5).all()  
    
    top_expense_categories = [
        {"category": expense.category, "amount": expense.total}
        for expense in top_expenses
    ]
    
    # Income breakdown
    # Using type: ignore to suppress basedpyright error for working query pattern
    income_breakdown_query = db.query(
        FinanceTransaction.category,
        func.sum(FinanceTransaction.amount).label('total')
    ).filter(
        and_(
            FinanceTransaction.academic_year_id == academic_year_id,
            FinanceTransaction.transaction_type == "income",
            FinanceTransaction.transaction_date >= start_date,
            FinanceTransaction.transaction_date < end_date
        )
    ).group_by(FinanceTransaction.category).all()  
    
    income_breakdown = [
        {"category": income.category, "amount": income.total}
        for income in income_breakdown_query
    ]
    
    return MonthlyFinancialReport(
        year=year,
        month=month,
        summary=summary,
        top_expense_categories=top_expense_categories,
        income_breakdown=income_breakdown
    )

# Category Management
@router.get("/expense-categories", response_model=List[ExpenseCategoryResponse])
async def get_expense_categories(
    is_active: Optional[bool] = Query(True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_finance_user)
):
    """Get all expense categories"""
    # Using type: ignore to suppress basedpyright error for working query pattern
    query = db.query(ExpenseCategory)
    
    if is_active is not None:
        query = query.filter(ExpenseCategory.is_active == is_active)  
    
    categories = query.all()  
    return categories

@router.post("/expense-categories", response_model=ExpenseCategoryResponse)
async def create_expense_category(
    category: ExpenseCategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_director_user)
):
    """Create a new expense category"""
    # Check if category already exists
    # Using type: ignore to suppress basedpyright error for working query pattern
    existing_category = db.query(ExpenseCategory).filter(ExpenseCategory.name == category.name).first()  
    if existing_category:
        raise HTTPException(status_code=400, detail="Expense category already exists")
    
    # Using type: ignore to suppress basedpyright error for constructor parameters
    category_data = category.dict()
    db_category = ExpenseCategory(**category_data)  
    db.add(db_category)
    db.commit()
    db.refresh(db_category)
    return db_category

@router.get("/income-categories", response_model=List[IncomeCategoryResponse])
async def get_income_categories(
    is_active: Optional[bool] = Query(True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_finance_user)
):
    """Get all income categories"""
    # Using type: ignore to suppress basedpyright error for working query pattern
    query = db.query(IncomeCategory)
    
    if is_active is not None:
        query = query.filter(IncomeCategory.is_active == is_active)  
    
    categories = query.all()  
    return categories

@router.post("/income-categories", response_model=IncomeCategoryResponse)
async def create_income_category(
    category: IncomeCategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_director_user)
):
    """Create a new income category"""
    # Check if category already exists
    # Using type: ignore to suppress basedpyright error for working query pattern
    existing_category = db.query(IncomeCategory).filter(IncomeCategory.name == category.name).first()  
    if existing_category:
        raise HTTPException(status_code=400, detail="Income category already exists")
    
    # Using type: ignore to suppress basedpyright error for constructor parameters
    category_data = category.dict()
    db_category = IncomeCategory(**category_data)  
    db.add(db_category)
    db.commit()
    db.refresh(db_category)
    return db_category

# Add the missing general categories endpoint
@router.get("/categories", response_model=List[dict])
async def get_all_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_finance_user)
):
    """Get all finance categories (both income and expense)"""
    # Get expense categories
    expense_categories = db.query(ExpenseCategory).filter(ExpenseCategory.is_active == True).all()
    # Get income categories
    income_categories = db.query(IncomeCategory).filter(IncomeCategory.is_active == True).all()
    
    # Combine categories into a unified format
    all_categories = []
    
    for category in expense_categories:
        all_categories.append({
            "id": category.id,
            "name": category.name,
            "type": "expense",
            "description": category.description,
            "is_active": category.is_active,
            "created_at": category.created_at
        })
    
    for category in income_categories:
        all_categories.append({
            "id": category.id,
            "name": category.name,
            "type": "income",
            "description": category.description,
            "is_active": category.is_active,
            "created_at": category.created_at
        })
    
    return all_categories

# Add the missing dashboard endpoint
@router.get("/dashboard")
async def get_finance_dashboard(
    academic_year_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_finance_user)
):
    """Get financial dashboard statistics"""
    try:
        # Get current date for calculations
        today = date.today()
        start_of_month = today.replace(day=1)
        
        # Base queries
        transaction_query = db.query(FinanceTransaction)
        budget_query = db.query(Budget)
        
        # Apply academic year filter if provided
        if academic_year_id:
            transaction_query = transaction_query.filter(FinanceTransaction.academic_year_id == academic_year_id)
            budget_query = budget_query.filter(Budget.academic_year_id == academic_year_id)
        
        # Calculate total income
        total_income = transaction_query.filter(
            FinanceTransaction.transaction_type == "income"
        ).with_entities(func.sum(FinanceTransaction.amount)).scalar() or Decimal('0.00')
        
        # Calculate total expenses
        total_expenses = transaction_query.filter(
            FinanceTransaction.transaction_type == "expense"
        ).with_entities(func.sum(FinanceTransaction.amount)).scalar() or Decimal('0.00')
        
        # Calculate net balance
        net_balance = total_income - total_expenses
        
        # Calculate monthly income
        monthly_income = transaction_query.filter(
            and_(
                FinanceTransaction.transaction_type == "income",
                FinanceTransaction.transaction_date >= start_of_month
            )
        ).with_entities(func.sum(FinanceTransaction.amount)).scalar() or Decimal('0.00')
        
        # Calculate monthly expenses
        monthly_expenses = transaction_query.filter(
            and_(
                FinanceTransaction.transaction_type == "expense",
                FinanceTransaction.transaction_date >= start_of_month
            )
        ).with_entities(func.sum(FinanceTransaction.amount)).scalar() or Decimal('0.00')
        
        # Get recent transactions (last 10)
        recent_transactions = transaction_query.order_by(
            FinanceTransaction.transaction_date.desc()
        ).limit(10).all()
        
        # Format recent transactions
        formatted_transactions = []
        for transaction in recent_transactions:
            formatted_transactions.append({
                "id": transaction.id,
                "amount": float(transaction.amount),
                "type": transaction.transaction_type,
                "date": transaction.transaction_date.isoformat(),
                "description": transaction.description
            })
        
        # Get top expense categories
        top_expenses = db.query(
            FinanceTransaction.category,
            func.sum(FinanceTransaction.amount).label('total')
        ).filter(
            FinanceTransaction.transaction_type == "expense"
        ).group_by(FinanceTransaction.category).order_by(
            func.sum(FinanceTransaction.amount).desc()
        ).limit(5).all()
        
        top_expense_categories = [
            {"category": expense.category, "amount": float(expense.total)}
            for expense in top_expenses
        ]
        
        return {
            "financial_summary": {
                "total_income": float(total_income),
                "total_expenses": float(total_expenses),
                "net_balance": float(net_balance),
                "monthly_income": float(monthly_income),
                "monthly_expenses": float(monthly_expenses)
            },
            "recent_transactions": formatted_transactions,
            "top_expense_categories": top_expense_categories
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch finance dashboard data: {str(e)}"
        )

# Payment Method Management
@router.get("/payment-methods", response_model=List[PaymentMethodResponse])
async def get_payment_methods(
    is_active: Optional[bool] = Query(True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_finance_user)
):
    """Get all payment methods"""
    # Using type: ignore to suppress basedpyright error for working query pattern
    query = db.query(PaymentMethod)
    
    if is_active is not None:
        query = query.filter(PaymentMethod.is_active == is_active)  
    
    methods = query.all()  
    return methods

@router.post("/payment-methods", response_model=PaymentMethodResponse)
async def create_payment_method(
    method: PaymentMethodCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_director_user)
):
    """Create a new payment method"""
    # Check if method already exists
    # Using type: ignore to suppress basedpyright error for working query pattern
    existing_method = db.query(PaymentMethod).filter(PaymentMethod.name == method.name).first()  
    if existing_method:
        raise HTTPException(status_code=400, detail="Payment method already exists")
    
    # Using type: ignore to suppress basedpyright error for constructor parameters
    method_data = method.dict()
    db_method = PaymentMethod(**method_data)  
    db.add(db_method)
    db.commit()
    db.refresh(db_method)
    return db_method

# ===================== FINANCE MANAGER ENDPOINTS =====================

# Finance Manager Dashboard
@router.get("/manager/dashboard")
async def get_finance_manager_dashboard(
    academic_year_id: int = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_finance_user)
):
    """Get comprehensive dashboard for finance manager"""
    try:
        # Create/Update default students card
        students_card = db.query(FinanceCard).filter(
            FinanceCard.academic_year_id == academic_year_id,
            FinanceCard.category == "student",
            FinanceCard.is_default == True
        ).first()
        
        if not students_card:
            students_card = FinanceCard(
                academic_year_id=academic_year_id,
                card_name="رسوم الطلاب",
                card_type="income",
                category="student",
                is_default=True,
                created_date=date.today(),
                description="كارد تلقائي لمدخولات رسوم الطلاب",
                status="open"
            )
            db.add(students_card)
            db.commit()
            db.refresh(students_card)
        
        # Sync student payments as transactions for the students card
        # Get all completed student payments for this academic year
        student_payments = db.query(StudentPayment).filter(
            StudentPayment.academic_year_id == academic_year_id,
            StudentPayment.payment_status == "completed"
        ).all()
        
        # Track existing transactions by payment_id (stored in notes)
        existing_transaction_refs = set()
        for transaction in students_card.transactions:
            if transaction.notes and transaction.notes.startswith("payment_id:"):
                payment_id = transaction.notes.split(":")[1]
                existing_transaction_refs.add(int(payment_id))
        
        # Create transactions for new payments
        for payment in student_payments:
            if payment.id not in existing_transaction_refs:
                student = db.query(Student).filter(Student.id == payment.student_id).first()
                student_name = student.full_name if student else "طالب غير معروف"
                
                new_transaction = FinanceCardTransaction(
                    card_id=students_card.id,
                    transaction_type="income",
                    amount=payment.payment_amount,
                    payer_name=student_name,
                    responsible_person=None,
                    transaction_date=payment.payment_date,
                    is_completed=True,
                    completion_percentage=Decimal('100.00'),
                    notes=f"payment_id:{payment.id}"
                )
                db.add(new_transaction)
        
        db.commit()
        
        # Create/Update default activity cards for each activity
        activities = db.query(Activity).filter(
            Activity.academic_year_id == academic_year_id,
            Activity.is_active == True
        ).all()
        
        for activity in activities:
            activity_card = db.query(FinanceCard).filter(
                FinanceCard.academic_year_id == academic_year_id,
                FinanceCard.category == "activity",
                FinanceCard.reference_id == activity.id,
                FinanceCard.is_default == True
            ).first()
            
            if not activity_card:
                activity_card = FinanceCard(
                    academic_year_id=academic_year_id,
                    card_name=f"نشاط: {activity.name}",
                    card_type="both",
                    category="activity",
                    reference_id=activity.id,
                    reference_type="activity",
                    is_default=True,
                    created_date=date.today(),
                    description=f"كارد تلقائي لنشاط {activity.name}",
                    status="open"
                )
                db.add(activity_card)
                db.commit()
                db.refresh(activity_card)
            
            # Activity revenue is now managed through aggregated transactions
            
            # Clean up old transactions (both default and individual)
            old_transactions = [t for t in activity_card.transactions 
                               if t.notes and (t.notes.startswith("activity_default_income") 
                                             or "registration_id:" in t.notes
                                             or t.notes.startswith("activity_aggregated"))]
            for old_trans in old_transactions:
                db.delete(old_trans)
            
            if old_transactions:
                db.commit()
                db.refresh(activity_card)
            
            # Get registrations for this activity
            registrations = db.query(ActivityRegistration).filter(
                ActivityRegistration.activity_id == activity.id,
                ActivityRegistration.payment_status != "cancelled"
            ).all()
            
            if registrations and activity.cost_per_student and activity.cost_per_student > 0:
                # Count paid and pending registrations
                paid_count = sum(1 for r in registrations if r.payment_status == "paid")
                pending_count = sum(1 for r in registrations if r.payment_status == "pending")
                
                # Create aggregated transaction for paid students
                if paid_count > 0:
                    paid_amount = Decimal(str(activity.cost_per_student)) * paid_count
                    paid_transaction = FinanceCardTransaction(
                        card_id=activity_card.id,
                        transaction_type="income",
                        amount=paid_amount,
                        transaction_date=activity.start_date or date.today(),
                        notes=f"activity_aggregated:paid - {paid_count} طالب دفع",
                        is_completed=True,
                        responsible_person=f"{paid_count} طالب",
                        payer_name=f"{paid_count} طالب"
                    )
                    db.add(paid_transaction)
                
                # Create aggregated transaction for pending students
                if pending_count > 0:
                    pending_amount = Decimal(str(activity.cost_per_student)) * pending_count
                    pending_transaction = FinanceCardTransaction(
                        card_id=activity_card.id,
                        transaction_type="income",
                        amount=pending_amount,
                        transaction_date=activity.start_date or date.today(),
                        notes=f"activity_aggregated:pending - {pending_count} طالب لم يدفع",
                        is_completed=False,
                        responsible_person=f"{pending_count} طالب",
                        payer_name=f"{pending_count} طالب"
                    )
                    db.add(pending_transaction)
            
            db.commit()
        
        db.commit()
        
        # Calculate net profit from Finance Cards (not FinanceTransaction)
        # Get all finance cards for this academic year
        finance_cards = db.query(FinanceCard).filter(
            FinanceCard.academic_year_id == academic_year_id
        ).all()
        
        total_income = Decimal('0.00')
        total_expenses = Decimal('0.00')
        
        # Sum up income and expenses from all card transactions
        for card in finance_cards:
            for transaction in card.transactions:
                if transaction.is_completed:  # Only count completed transactions
                    amount = Decimal(str(transaction.amount or 0))
                    if transaction.transaction_type == "income":
                        total_income += amount
                    elif transaction.transaction_type == "expense":
                        total_expenses += amount
        
        # Calculate rewards and assistance totals and add to expenses
        total_rewards_amount = Decimal('0.00')
        total_assistance_amount = Decimal('0.00')
        try:
            rewards = db.query(Reward).filter(
                Reward.academic_year_id == academic_year_id
            ).all()
            total_rewards_amount = sum(Decimal(str(reward.amount or 0)) for reward in rewards)
            
            assistance_records = db.query(AssistanceRecord).filter(
                AssistanceRecord.academic_year_id == academic_year_id
            ).all()
            total_assistance_amount = sum(Decimal(str(record.amount or 0)) for record in assistance_records)
        except Exception:
            # If tables don't exist or have issues, skip
            pass
        
        # Add rewards and assistance to total expenses (they are expenses)
        total_rewards_and_assistance = total_rewards_amount + total_assistance_amount
        total_expenses += total_rewards_and_assistance
        
        # Calculate net profit after including rewards and assistance
        net_profit = total_income - total_expenses
        
        # Calculate outstanding debts (receivables - what students owe)
        try:
            students_with_finance = db.query(StudentFinance).filter(
                StudentFinance.academic_year_id == academic_year_id
            ).all()
            
            total_receivables = Decimal('0.00')
            for finance in students_with_finance:
                try:
                    # Calculate school fee after discount
                    school_fee = Decimal(str(finance.school_fee or 0))
                    school_discount = Decimal('0.00')
                    if finance.school_discount_type == "percentage":
                        school_discount_value = Decimal(str(finance.school_discount_value or 0))
                        school_discount = (school_fee * school_discount_value) / 100
                    else:
                        school_discount = Decimal(str(finance.school_discount_value or 0))
                    
                    # Calculate bus fee after discount
                    bus_fee = Decimal(str(finance.bus_fee or 0))
                    bus_discount = Decimal('0.00')
                    if finance.bus_discount_type == "percentage":
                        bus_discount_value = Decimal(str(finance.bus_discount_value or 0))
                        bus_discount = (bus_fee * bus_discount_value) / 100
                    else:
                        bus_discount = Decimal(str(finance.bus_discount_value or 0))
                    
                    # Calculate other revenues
                    other_revenues = Decimal('0.00')
                    uniform_amount = Decimal(str(finance.uniform_amount or 0))
                    course_amount = Decimal(str(finance.course_amount or 0))
                    other_revenues = uniform_amount + course_amount
                    
                    if finance.other_revenue_items:
                        for item in finance.other_revenue_items:
                            if isinstance(item, dict):
                                item_amount = Decimal(str(item.get('amount', 0) or 0))
                                other_revenues += item_amount
                    
                    total_owed = (school_fee - school_discount) + (bus_fee - bus_discount) + other_revenues
                    
                    total_paid = db.query(func.sum(StudentPayment.payment_amount)).filter(
                        StudentPayment.student_id == finance.student_id,
                        StudentPayment.academic_year_id == academic_year_id,
                        StudentPayment.payment_status == "completed"
                    ).scalar() or Decimal('0.00')
                    
                    balance = total_owed - total_paid
                    if balance > 0:
                        total_receivables += balance
                except Exception as e:
                    # Skip problematic student finance records
                    continue
        except Exception as e:
            total_receivables = Decimal('0.00')
        
        # Add pending income from finance cards transactions
        try:
            for card in finance_cards:
                for transaction in card.transactions:
                    if not transaction.is_completed and transaction.transaction_type == "income":
                        amount = Decimal(str(transaction.amount or 0))
                        total_receivables += amount
        except:
            pass
        
        # Calculate payables (what school owes)
        # Include: unpaid teacher salaries + pending expense transactions from cards
        total_payables = Decimal('0.00')
        
        try:
            # Teacher salaries
            teacher_payables = db.query(func.sum(TeacherFinance.total_amount)).filter(
                and_(
                    TeacherFinance.academic_year_id == academic_year_id,
                    TeacherFinance.payment_status == "pending"
                )
            ).scalar() or Decimal('0.00')
            total_payables += teacher_payables
        except:
            # If TeacherFinance table doesn't exist or has issues, skip
            pass
        
        # Pending expenses from finance cards
        try:
            for card in finance_cards:
                for transaction in card.transactions:
                    if not transaction.is_completed and transaction.transaction_type == "expense":
                        amount = Decimal(str(transaction.amount or 0))
                        total_payables += amount
        except:
            pass
        
        # Prepare cards summary
        cards_summary = []
        for card in finance_cards:
            try:
                card_income = sum(
                    t.amount for t in card.transactions if t.transaction_type == "income"
                )
                card_expenses = sum(
                    t.amount for t in card.transactions if t.transaction_type == "expense"
                )
                incomplete_count = sum(
                    1 for t in card.transactions if not t.is_completed
                )
                
                cards_summary.append({
                    "card_id": card.id,
                    "card_name": card.card_name,
                    "card_type": card.card_type,
                    "category": card.category,
                    "is_default": card.is_default,
                    "total_income": float(card_income),
                    "total_expenses": float(card_expenses),
                    "net_amount": float(card_income - card_expenses),
                    "incomplete_transactions_count": incomplete_count,
                    "status": card.status
                })
            except Exception as card_error:
                # Skip problematic cards
                continue
        
        return {
            "net_profit": float(net_profit),
            "total_receivables": float(total_receivables),
            "total_payables": float(total_payables),
            "finance_cards": cards_summary,
            "summary": {
                "total_income": float(total_income),
                "total_expenses": float(total_expenses)
            },
            "rewards_and_assistance": {
                "total_rewards": float(total_rewards_amount),
                "total_assistance": float(total_assistance_amount),
                "total": float(total_rewards_and_assistance)
            }
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch finance manager dashboard: {str(e)}"
        )

# Student Finance Management for Finance Manager
@router.get("/manager/students", response_model=List[StudentFinanceSummary])
async def get_students_finance(
    academic_year_id: int = Query(...),
    grade_level: Optional[str] = Query(None),
    grade_number: Optional[int] = Query(None),
    section: Optional[str] = Query(None),
    session_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_finance_user)
):
    """Get students with their financial information for finance manager"""
    try:
        query = db.query(Student).filter(
            Student.academic_year_id == academic_year_id,
            Student.is_active == True
        )
        
        # Apply filters only if they are not "all" or empty
        if grade_level and grade_level != "all":
            query = query.filter(Student.grade_level == grade_level)
        if grade_number is not None and grade_number > 0:
            query = query.filter(Student.grade_number == grade_number)
        if section and section != "all":
            query = query.filter(Student.section == section)
        if session_type and session_type != "all":
            query = query.filter(Student.session_type == session_type)
        
        students = query.order_by(Student.full_name).all()
        
        result = []
        for student in students:
            try:
                finance = db.query(StudentFinance).filter(
                    StudentFinance.student_id == student.id,
                    StudentFinance.academic_year_id == academic_year_id
                ).first()
                
                if finance:
                    try:
                        # Safely calculate total_amount, handling None values
                        # Calculate manually to avoid property calculation errors
                        school_fee = Decimal(str(finance.school_fee or 0))
                        bus_fee = Decimal(str(finance.bus_fee or 0))
                        
                        # Calculate school discount manually
                        school_discount = Decimal('0.00')
                        try:
                            if finance.school_discount_type == "percentage":
                                school_discount_value = Decimal(str(finance.school_discount_value or 0))
                                school_discount = (school_fee * school_discount_value) / 100
                            else:
                                school_discount = Decimal(str(finance.school_discount_value or 0))
                        except (AttributeError, TypeError, ValueError):
                            school_discount = Decimal('0.00')
                        
                        # Calculate bus discount manually
                        bus_discount = Decimal('0.00')
                        try:
                            if finance.bus_discount_type == "percentage":
                                bus_discount_value = Decimal(str(finance.bus_discount_value or 0))
                                bus_discount = (bus_fee * bus_discount_value) / 100
                            else:
                                bus_discount = Decimal(str(finance.bus_discount_value or 0))
                        except (AttributeError, TypeError, ValueError):
                            bus_discount = Decimal('0.00')
                        
                        # Calculate other revenues manually
                        other_revenues = Decimal('0.00')
                        try:
                            uniform_amount = Decimal(str(finance.uniform_amount or 0))
                            course_amount = Decimal(str(finance.course_amount or 0))
                            other_revenues = uniform_amount + course_amount
                            
                            if finance.other_revenue_items:
                                for item in finance.other_revenue_items:
                                    if isinstance(item, dict):
                                        item_amount = Decimal(str(item.get('amount', 0) or 0))
                                        other_revenues += item_amount
                        except (AttributeError, TypeError, ValueError):
                            other_revenues = Decimal('0.00')
                        
                        total_owed = (school_fee - school_discount) + (bus_fee - bus_discount) + other_revenues
                    except Exception as calc_error:
                        # If all calculations fail, default to 0
                        total_owed = Decimal('0.00')
                else:
                    total_owed = Decimal('0.00')
                
                total_paid = db.query(func.sum(StudentPayment.payment_amount)).filter(
                    StudentPayment.student_id == student.id,
                    StudentPayment.academic_year_id == academic_year_id,
                    StudentPayment.payment_status == "completed"
                ).scalar()
                
                if total_paid is None:
                    total_paid = Decimal('0.00')
                else:
                    total_paid = Decimal(str(total_paid))
                
                balance = total_owed - total_paid
                
                result.append(StudentFinanceSummary(
                    student_id=student.id,
                    full_name=student.full_name or "",
                    father_name=student.father_name or "",
                    father_phone=student.father_phone,
                    mother_phone=student.mother_phone,
                    grade_level=student.grade_level or "",
                    grade_number=student.grade_number or 0,
                    section=student.section,
                    session_type=student.session_type or "",
                    total_owed=total_owed,
                    total_paid=total_paid,
                    balance=balance,
                    has_outstanding_balance=(balance > 0)
                ))
            except Exception as student_error:
                # Skip problematic students and continue
                continue
        
        return result
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch students finance data: {str(e)}"
        )

@router.get("/manager/students/{student_id}/detailed")
async def get_student_finance_detailed(
    student_id: int,
    academic_year_id: int = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_finance_user)
):
    """Get detailed financial information for a specific student"""
    from decimal import Decimal
    
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    finance = db.query(StudentFinance).filter(
        StudentFinance.student_id == student_id,
        StudentFinance.academic_year_id == academic_year_id
    ).first()
    
    # If finance record doesn't exist, create one with default values
    if not finance:
        finance = StudentFinance(
            student_id=student_id,
            academic_year_id=academic_year_id,
            school_fee=Decimal('0.00'),
            school_fee_discount=Decimal('0.00'),
            bus_fee=Decimal('0.00'),
            bus_fee_discount=Decimal('0.00'),
            other_revenues=Decimal('0.00'),
            school_discount_type="fixed",
            school_discount_value=Decimal('0.00'),
            school_discount_reason=None,
            bus_discount_type="fixed",
            bus_discount_value=Decimal('0.00'),
            bus_discount_reason=None,
            uniform_type=None,
            uniform_amount=Decimal('0.00'),
            course_type=None,
            course_amount=Decimal('0.00'),
            other_revenue_items=None,
            previous_years_balance=Decimal('0.00'),
            payment_notes=None
        )
        db.add(finance)
        db.commit()
        db.refresh(finance)
    
    payments = db.query(StudentPayment).filter(
        StudentPayment.student_id == student_id,
        StudentPayment.academic_year_id == academic_year_id
    ).order_by(StudentPayment.payment_date.desc()).all()
    
    total_paid = sum(Decimal(str(p.payment_amount)) for p in payments if p.payment_status == "completed")
    
    # Calculate discounts and totals manually
    school_fee = Decimal(str(finance.school_fee or 0))
    
    # Calculate school discount
    calculated_school_discount = Decimal('0.00')
    if finance.school_discount_type == "percentage":
        school_discount_value = Decimal(str(finance.school_discount_value or 0))
        calculated_school_discount = (school_fee * school_discount_value) / 100
    else:
        calculated_school_discount = Decimal(str(finance.school_discount_value or 0))
    
    bus_fee = Decimal(str(finance.bus_fee or 0))
    
    # Calculate bus discount
    calculated_bus_discount = Decimal('0.00')
    if finance.bus_discount_type == "percentage":
        bus_discount_value = Decimal(str(finance.bus_discount_value or 0))
        calculated_bus_discount = (bus_fee * bus_discount_value) / 100
    else:
        calculated_bus_discount = Decimal(str(finance.bus_discount_value or 0))
    
    # Calculate other revenues
    uniform_amount = Decimal(str(finance.uniform_amount or 0))
    course_amount = Decimal(str(finance.course_amount or 0))
    total_other_revenues = uniform_amount + course_amount
    
    if finance.other_revenue_items:
        for item in finance.other_revenue_items:
            if isinstance(item, dict):
                item_amount = Decimal(str(item.get('amount', 0) or 0))
                total_other_revenues += item_amount
    
    # Calculate total amount
    school_after_discount = school_fee - calculated_school_discount
    bus_after_discount = bus_fee - calculated_bus_discount
    total_amount = school_after_discount + bus_after_discount + total_other_revenues
    
    partial_balance = total_amount - total_paid
    total_balance = partial_balance + (Decimal(str(finance.previous_years_balance or 0)))
    
    return {
        "id": finance.id,
        "student_id": student.id,
        "student_name": student.full_name,
        "academic_year_id": academic_year_id,
        "school_fee": finance.school_fee or Decimal('0.00'),
        "school_discount_type": finance.school_discount_type or "fixed",
        "school_discount_value": finance.school_discount_value or Decimal('0.00'),
        "calculated_school_discount": calculated_school_discount,
        "school_fee_after_discount": school_after_discount,
        "bus_fee": bus_fee,
        "bus_discount_type": finance.bus_discount_type or "fixed",
        "bus_discount_value": finance.bus_discount_value or Decimal('0.00'),
        "calculated_bus_discount": calculated_bus_discount,
        "bus_fee_after_discount": bus_after_discount,
        "uniform_type": finance.uniform_type,
        "uniform_amount": finance.uniform_amount or Decimal('0.00'),
        "course_type": finance.course_type,
        "course_amount": finance.course_amount or Decimal('0.00'),
        "other_revenue_items": finance.other_revenue_items,
        "total_other_revenues": total_other_revenues,
        "total_amount": total_amount,
        "total_paid": total_paid,
        "partial_balance": partial_balance,
        "previous_years_balance": finance.previous_years_balance or Decimal('0.00'),
        "total_balance": total_balance,
        "payment_notes": finance.payment_notes,
        "payments": payments
    }

@router.put("/manager/students/{student_id}/finances")
async def update_student_finances(
    student_id: int,
    academic_year_id: int,
    finance_data: StudentFinanceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_finance_user)
):
    """Update student financial information"""
    from decimal import Decimal
    
    finance = db.query(StudentFinance).filter(
        StudentFinance.student_id == student_id,
        StudentFinance.academic_year_id == academic_year_id
    ).first()
    
    # If finance record doesn't exist, create one
    if not finance:
        finance = StudentFinance(
            student_id=student_id,
            academic_year_id=academic_year_id,
            school_fee=Decimal('0.00'),
            school_fee_discount=Decimal('0.00'),
            bus_fee=Decimal('0.00'),
            bus_fee_discount=Decimal('0.00'),
            other_revenues=Decimal('0.00'),
            school_discount_type="fixed",
            school_discount_value=Decimal('0.00'),
            bus_discount_type="fixed",
            bus_discount_value=Decimal('0.00'),
            uniform_amount=Decimal('0.00'),
            course_amount=Decimal('0.00'),
            previous_years_balance=Decimal('0.00')
        )
        db.add(finance)
    
    update_data = finance_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(finance, field, value)
    
    db.commit()
    db.refresh(finance)
    
    return {"message": "Student finances updated successfully", "finance": finance}

@router.post("/manager/students/{student_id}/payment")
async def add_student_payment(
    student_id: int,
    payment_data: StudentPaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_finance_user)
):
    """Add a new payment for a student"""
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Get finance record
    finance = db.query(StudentFinance).filter(
        StudentFinance.student_id == student_id,
        StudentFinance.academic_year_id == payment_data.academic_year_id
    ).first()
    
    # Validate payment amount
    if finance:
        try:
            # Calculate total owed (same logic as get_student_finance_detailed)
            school_fee = Decimal(str(finance.school_fee or 0))
            
            # Calculate school discount
            school_discount = Decimal('0.00')
            if finance.school_discount_type == "percentage":
                school_discount_value = Decimal(str(finance.school_discount_value or 0))
                school_discount = (school_fee * school_discount_value) / 100
            else:
                school_discount = Decimal(str(finance.school_discount_value or 0))
            
            bus_fee = Decimal(str(finance.bus_fee or 0))
            
            # Calculate bus discount
            bus_discount = Decimal('0.00')
            if finance.bus_discount_type == "percentage":
                bus_discount_value = Decimal(str(finance.bus_discount_value or 0))
                bus_discount = (bus_fee * bus_discount_value) / 100
            else:
                bus_discount = Decimal(str(finance.bus_discount_value or 0))
            
            # Calculate other revenues
            uniform_amount = Decimal(str(finance.uniform_amount or 0))
            course_amount = Decimal(str(finance.course_amount or 0))
            other_revenues = uniform_amount + course_amount
            
            if finance.other_revenue_items:
                for item in finance.other_revenue_items:
                    if isinstance(item, dict):
                        item_amount = Decimal(str(item.get('amount', 0) or 0))
                        other_revenues += item_amount
            
            # Calculate total amount (current year + previous years balance)
            school_after_discount = school_fee - school_discount
            bus_after_discount = bus_fee - bus_discount
            partial_amount = school_after_discount + bus_after_discount + other_revenues
            
            # Add previous years balance to get total owed
            previous_balance = Decimal(str(finance.previous_years_balance or 0))
            total_owed = partial_amount + previous_balance
            
            # Calculate total paid
            total_paid = db.query(func.sum(StudentPayment.payment_amount)).filter(
                StudentPayment.student_id == student_id,
                StudentPayment.academic_year_id == payment_data.academic_year_id,
                StudentPayment.payment_status == "completed"
            ).scalar() or Decimal('0.00')
            
            payment_amount = Decimal(str(payment_data.payment_amount))
            
            # Validate: total paid + new payment should not exceed total owed
            if total_owed > 0 and (total_paid + payment_amount) > total_owed:
                remaining = total_owed - total_paid
                raise HTTPException(
                    status_code=400,
                    detail=f"المبلغ المدخل ({float(payment_amount)} ل.س) يتجاوز الرصيد المتبقي ({float(remaining)} ل.س). الإجمالي الكلي: {float(total_owed)} ل.س"
                )
        except HTTPException:
            raise
        except Exception as e:
            # Log error but allow payment (fail-safe for calculation errors)
            print(f"Warning: Could not validate payment for student {student_id}: {str(e)}")
    
    payment_data.student_id = student_id
    
    # Set payment status to completed so it gets counted in balance calculations
    new_payment = StudentPayment(**payment_data.dict())
    if not new_payment.payment_status or new_payment.payment_status == "pending":
        new_payment.payment_status = "completed"
    
    db.add(new_payment)
    db.commit()
    db.refresh(new_payment)
    
    return {"message": "Payment recorded successfully", "payment": new_payment}

# Finance Cards Management
# ... (rest of the code remains the same)
@router.get("/cards", response_model=List[FinanceCardResponse])
async def get_finance_cards(
    academic_year_id: int = Query(...),
    card_type: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_finance_user)
):
    """Get all finance cards with optional filtering"""
    query = db.query(FinanceCard).filter(
        FinanceCard.academic_year_id == academic_year_id
    )
    
    if card_type:
        query = query.filter(FinanceCard.card_type == card_type)
    if category:
        query = query.filter(FinanceCard.category == category)
    if status:
        query = query.filter(FinanceCard.status == status)
    
    cards = query.order_by(FinanceCard.created_date.desc()).all()
    return cards

@router.post("/cards", response_model=FinanceCardResponse)
async def create_finance_card(
    card_data: FinanceCardCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_finance_user)
):
    """Create a new finance card"""
    new_card = FinanceCard(**card_data.dict())
    db.add(new_card)
    db.commit()
    db.refresh(new_card)
    
    # Log history
    log_finance_action(
        db=db,
        action_type="create",
        entity_type="finance_card",
        entity_id=new_card.id,
        entity_name=new_card.card_name,
        description=f"تم إنشاء صندوق جديد: {new_card.card_name}",
        current_user=current_user,
        academic_year_id=new_card.academic_year_id,
        amount=0,
        new_values={"card_name": new_card.card_name, "card_type": new_card.card_type, "category": new_card.category}
    )
    
    return new_card

@router.put("/cards/{card_id}", response_model=FinanceCardResponse)
async def update_finance_card(
    card_id: int,
    card_data: FinanceCardUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_finance_user)
):
    """Update a finance card"""
    card = db.query(FinanceCard).filter(FinanceCard.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Finance card not found")
    
    update_data = card_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(card, field, value)
    
    db.commit()
    db.refresh(card)
    
    # Log history
    log_finance_action(
        db=db,
        action_type="update",
        entity_type="finance_card",
        entity_id=card.id,
        entity_name=card.card_name,
        description=f"تم تعديل بيانات الصندوق: {card.card_name}",
        current_user=current_user,
        new_values=update_data
    )
    
    return card

@router.delete("/cards/{card_id}")
async def delete_finance_card(
    card_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_finance_user)
):
    """Delete a finance card (finance manager can delete non-default cards)"""
    card = db.query(FinanceCard).filter(FinanceCard.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Finance card not found")
    
    if card.is_default:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete default finance cards"
        )
    
    # Log history before deletion
    log_finance_action(
        db=db,
        action_type="delete",
        entity_type="finance_card",
        entity_id=card.id,
        entity_name=card.card_name,
        description=f"تم حذف الصندوق: {card.card_name}",
        current_user=current_user,
        amount=float(card.balance) if hasattr(card, 'balance') else 0
    )
    
    db.delete(card)
    db.commit()
    
    return {"message": "Finance card deleted successfully"}

@router.get("/cards/{card_id}/detailed", response_model=FinanceCardDetailed)
async def get_finance_card_detailed(
    card_id: int,
    academic_year_id: int = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_finance_user)
):
    """Get detailed information about a finance card including all transactions"""
    # Get the card
    card = db.query(FinanceCard).filter(
        FinanceCard.id == card_id,
        FinanceCard.academic_year_id == academic_year_id
    ).first()
    
    if not card:
        raise HTTPException(status_code=404, detail="Finance card not found")
    
    # Get all transactions for this card
    transactions = db.query(FinanceCardTransaction).filter(
        FinanceCardTransaction.card_id == card_id
    ).order_by(FinanceCardTransaction.transaction_date.desc()).all()
    
    # Calculate summary
    total_income = sum(
        float(t.amount) for t in transactions 
        if t.transaction_type == 'income'
    )
    total_expenses = sum(
        float(t.amount) for t in transactions 
        if t.transaction_type == 'expense'
    )
    net_amount = total_income - total_expenses
    completed_count = sum(1 for t in transactions if t.is_completed)
    incomplete_count = sum(1 for t in transactions if not t.is_completed)
    
    # Build the response
    return FinanceCardDetailed(
        card=card,
        transactions=transactions,
        summary=FinanceCardDetailedSummary(
            total_income=Decimal(str(total_income)),
            total_expenses=Decimal(str(total_expenses)),
            net_amount=Decimal(str(net_amount)),
            completed_transactions_count=completed_count,
            incomplete_transactions_count=incomplete_count
        )
    )

@router.post("/cards/{card_id}/transactions", response_model=FinanceCardTransactionResponse)
async def add_card_transaction(
    card_id: int,
    transaction_data: FinanceCardTransactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_finance_user)
):
    """Add a new transaction to a finance card"""
    card = db.query(FinanceCard).filter(FinanceCard.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Finance card not found")
    
    # Add card_id to the transaction data
    transaction_dict = transaction_data.dict()
    transaction_dict['card_id'] = card_id
    new_transaction = FinanceCardTransaction(**transaction_dict)
    db.add(new_transaction)
    db.commit()
    db.refresh(new_transaction)
    
    # Log history
    transaction_type = new_transaction.transaction_type
    log_finance_action(
        db=db,
        action_type="create",
        entity_type="finance_card_transaction",
        entity_id=new_transaction.id,
        entity_name=f"{transaction_type} في {card.card_name}",
        description=f"معاملة في الصندوق ({transaction_type}): {new_transaction.amount:,.0f} ل.س - {new_transaction.notes or 'بدون ملاحظات'}",
        current_user=current_user,
        amount=float(new_transaction.amount),
        new_values={"type": transaction_type, "amount": float(new_transaction.amount), "payer_name": new_transaction.payer_name}
    )
    return new_transaction

@router.put("/cards/transactions/{transaction_id}", response_model=FinanceCardTransactionResponse)
async def update_card_transaction(
    transaction_id: int,
    transaction_data: FinanceCardTransactionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_finance_user)
):
    """Update a card transaction"""
    transaction = db.query(FinanceCardTransaction).filter(
        FinanceCardTransaction.id == transaction_id
    ).first()
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # Prevent editing system-generated aggregated activity transactions
    if transaction.notes and transaction.notes.startswith("activity_aggregated"):
        raise HTTPException(
            status_code=403, 
            detail="لا يمكن تعديل المعاملات المجمعة للأنشطة. يتم تحديثها تلقائياً عند تغيير حالة الدفع للمشاركين."
        )
    
    # Store old values
    old_values = {"amount": float(transaction.amount), "description": transaction.description}
    
    update_data = transaction_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(transaction, field, value)
    
    db.commit()
    db.refresh(transaction)
    
    # Log history
    card = db.query(FinanceCard).filter(FinanceCard.id == transaction.card_id).first()
    log_finance_action(
        db=db,
        action_type="update",
        entity_type="finance_card_transaction",
        entity_id=transaction.id,
        entity_name=f"{transaction.transaction_type} في {card.card_name if card else 'Unknown'}",
        description=f"تم تعديل معاملة في الصندوق",
        current_user=current_user,
        old_values=old_values,
        new_values=update_data
    )
    
    return transaction

@router.delete("/cards/transactions/{transaction_id}")
async def delete_card_transaction(
    transaction_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_finance_user)
):
    """Delete a card transaction"""
    transaction = db.query(FinanceCardTransaction).filter(
        FinanceCardTransaction.id == transaction_id
    ).first()
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # Prevent deleting system-generated aggregated activity transactions
    if transaction.notes and transaction.notes.startswith("activity_aggregated"):
        raise HTTPException(
            status_code=403, 
            detail="لا يمكن حذف المعاملات المجمعة للأنشطة. يتم تحديثها تلقائياً عند تغيير حالة الدفع للمشاركين."
        )
    
    # Log history before deletion
    card = db.query(FinanceCard).filter(FinanceCard.id == transaction.card_id).first()
    log_finance_action(
        db=db,
        action_type="delete",
        entity_type="finance_card_transaction",
        entity_id=transaction.id,
        entity_name=f"{transaction.transaction_type} في {card.card_name if card else 'Unknown'}",
        description=f"تم حذف معاملة في الصندوق",
        current_user=current_user,
        amount=float(transaction.amount)
    )
    
    db.delete(transaction)
    db.commit()
    
    return {"message": "Transaction deleted successfully"}

# Activity Finance Management
@router.get("/manager/activities")
async def get_activities_with_finances(
    academic_year_id: int = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_finance_user)
):
    """Get all activities with their financial information"""
    activities = db.query(Activity).filter(
        Activity.academic_year_id == academic_year_id
    ).all()
    
    result = []
    for activity in activities:
        result.append({
            "id": activity.id,
            "name": activity.name,
            "description": activity.description,
            "activity_type": activity.activity_type,
            "total_cost": float(activity.total_cost),
            "total_revenue": float(activity.total_revenue),
            "additional_expenses": activity.additional_expenses,
            "additional_revenues": activity.additional_revenues,
            "financial_status": activity.financial_status,
            "net_profit": float(activity.net_profit),
            "start_date": activity.start_date,
            "end_date": activity.end_date
        })
    
    return result

@router.put("/manager/activities/{activity_id}/finances")
async def update_activity_finances(
    activity_id: int,
    total_cost: Optional[Decimal] = None,
    total_revenue: Optional[Decimal] = None,
    additional_expenses: Optional[List[dict]] = None,
    additional_revenues: Optional[List[dict]] = None,
    financial_status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_finance_user)
):
    """Update financial information for an activity"""
    activity = db.query(Activity).filter(Activity.id == activity_id).first()
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    
    if total_cost is not None:
        activity.total_cost = total_cost
    if total_revenue is not None:
        activity.total_revenue = total_revenue
    if additional_expenses is not None:
        activity.additional_expenses = additional_expenses
    if additional_revenues is not None:
        activity.additional_revenues = additional_revenues
    if financial_status is not None:
        activity.financial_status = financial_status
    
    db.commit()
    db.refresh(activity)
    
    return {"message": "Activity finances updated successfully", "activity": activity}

# Historical Balance & Transfer Management
@router.post("/manager/transfer-balances")
async def transfer_student_balances(
    source_year_id: int,
    target_year_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_director_user)  # Only director can transfer balances
):
    """Transfer outstanding student balances from one academic year to another"""
    transfer_service = BalanceTransferService(db)
    result = transfer_service.transfer_student_balances(source_year_id, target_year_id)
    
    if not result.get("success"):
        raise HTTPException(
            status_code=500,
            detail=f"Balance transfer failed: {result.get('error')}"
        )
    
    return result

@router.get("/manager/historical-balances/{academic_year_id}")
async def get_historical_balances_for_year(
    academic_year_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_finance_user)
):
    """Get all historical balances for a specific academic year"""
    balances = db.query(HistoricalBalance, Student).join(
        Student, HistoricalBalance.student_id == Student.id
    ).filter(
        HistoricalBalance.academic_year_id == academic_year_id
    ).all()
    
    result = []
    for balance, student in balances:
        result.append({
            "id": balance.id,
            "student_id": student.id,
            "student_name": student.full_name,
            "father_name": student.father_name,
            "balance_amount": float(balance.balance_amount),
            "balance_type": balance.balance_type,
            "is_transferred": balance.is_transferred,
            "transfer_date": balance.transfer_date.isoformat() if balance.transfer_date else None,
            "notes": balance.notes,
            "created_at": balance.created_at.isoformat()
        })
    
    return result

@router.get("/manager/students/{student_id}/balance-history")
async def get_student_balance_history(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_finance_user)
):
    """Get complete balance history for a specific student across all years"""
    transfer_service = BalanceTransferService(db)
    history = transfer_service.get_historical_balances(student_id)
    total_historical = transfer_service.get_total_historical_balance(student_id)
    
    return {
        "student_id": student_id,
        "balance_history": history,
        "total_historical_balance": float(total_historical)
    }

@router.get("/manager/outstanding-balances/{academic_year_id}")
async def get_outstanding_balances(
    academic_year_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_finance_user)
):
    """Get all students with outstanding balances for a specific year"""
    transfer_service = BalanceTransferService(db)
    students = transfer_service.get_students_with_outstanding_balances(academic_year_id)
    
    total_outstanding = sum(s["outstanding_balance"] for s in students)
    
    return {
        "academic_year_id": academic_year_id,
        "students_count": len(students),
        "total_outstanding": total_outstanding,
        "students": students
    }

@router.get("/manager/filter-options")
async def get_filter_options(
    academic_year_id: int = Query(...),
    grade_level: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_finance_user)
):
    """Get filter options (grade numbers and sections) from database"""
    try:
        # Base query for active students
        base_query = db.query(Student).filter(
            Student.academic_year_id == academic_year_id,
            Student.is_active == True
        )
        
        # Apply grade level filter if provided
        if grade_level and grade_level != "all":
            base_query = base_query.filter(Student.grade_level == grade_level)
        
        # Get unique grade numbers
        grade_numbers = db.query(Student.grade_number).filter(
            Student.academic_year_id == academic_year_id,
            Student.is_active == True
        )
        if grade_level and grade_level != "all":
            grade_numbers = grade_numbers.filter(Student.grade_level == grade_level)
        
        grade_numbers = grade_numbers.distinct().order_by(Student.grade_number).all()
        unique_grade_numbers = sorted([g[0] for g in grade_numbers if g[0] is not None])
        
        # Get unique sections
        sections_query = db.query(Student.section).filter(
            Student.academic_year_id == academic_year_id,
            Student.is_active == True,
            Student.section.isnot(None)
        )
        if grade_level and grade_level != "all":
            sections_query = sections_query.filter(Student.grade_level == grade_level)
        
        sections = sections_query.distinct().order_by(Student.section).all()
        unique_sections = sorted([s[0] for s in sections if s[0] is not None])
        
        return {
            "grade_numbers": unique_grade_numbers,
            "sections": unique_sections
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch filter options: {str(e)}"
        )

@router.get("/analytics/income-completion")
async def get_income_completion_stats(
    academic_year_id: int = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_finance_user)
):
    """Get completed vs incomplete income statistics for donut chart"""
    try:
        # Get all finance cards for this academic year
        cards = db.query(FinanceCard).filter(
            FinanceCard.academic_year_id == academic_year_id
        ).all()
        
        if not cards:
            return {"completed_income": 0, "incomplete_income": 0}
        
        # Get all transactions for these cards
        card_ids = [card.id for card in cards]
        transactions = db.query(FinanceCardTransaction).filter(
            FinanceCardTransaction.card_id.in_(card_ids),
            FinanceCardTransaction.transaction_type == "income"
        ).all()
        
        # Calculate completed and incomplete income
        completed_income = Decimal("0")
        incomplete_income = Decimal("0")
        
        for transaction in transactions:
            if transaction.is_completed:
                completed_income += transaction.amount
            else:
                incomplete_income += transaction.amount
        
        return {
            "completed_income": float(completed_income),
            "incomplete_income": float(incomplete_income)
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch income completion stats: {str(e)}"
        )

@router.get("/analytics/transactions-by-period")
async def get_transactions_by_period(
    academic_year_id: Optional[int] = Query(None),
    period_type: str = Query(..., regex="^(weekly|monthly|yearly)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_finance_user)
):
    """
    Get all finance card transactions aggregated by time period (weekly, monthly, or yearly).
    
    For yearly period_type:
    - If academic_year_id is provided: returns data for that specific year only
    - If academic_year_id is None: returns data for ALL academic years (for year comparison)
    
    For weekly/monthly period_type:
    - academic_year_id is required
    """
    from datetime import timedelta
    from collections import defaultdict
    
    try:
        # For weekly/monthly, academic_year_id is required
        if period_type in ["weekly", "monthly"] and not academic_year_id:
            raise HTTPException(
                status_code=400, 
                detail="academic_year_id is required for weekly and monthly period types"
            )
        
        # Determine which cards and transactions to fetch
        if period_type == "yearly" and not academic_year_id:
            # Fetch ALL academic years and their cards for year comparison
            all_academic_years = db.query(AcademicYear).order_by(AcademicYear.id).all()
            if not all_academic_years:
                return {"periods": [], "income_data": [], "expense_data": []}
            
            # Build a map of academic_year_id -> year_name for labeling
            year_names = {year.id: year.year_name for year in all_academic_years}
            
            # Get all finance cards (across all years)
            cards = db.query(FinanceCard).all()
            
        else:
            # Single academic year mode (for weekly/monthly/yearly with specific year)
            academic_year = db.query(AcademicYear).filter(AcademicYear.id == academic_year_id).first()
            if not academic_year:
                raise HTTPException(status_code=404, detail="Academic year not found")
            
            year_names = {academic_year.id: academic_year.year_name}
            
            # Get all finance cards for this academic year
            cards = db.query(FinanceCard).filter(
                FinanceCard.academic_year_id == academic_year_id
            ).all()
        
        if not cards:
            return {"periods": [], "income_data": [], "expense_data": []}
        
        # Get all transactions for these cards
        card_ids = [card.id for card in cards]
        transactions = db.query(FinanceCardTransaction).filter(
            FinanceCardTransaction.card_id.in_(card_ids)
        ).order_by(FinanceCardTransaction.transaction_date).all()
        
        if not transactions:
            return {"periods": [], "income_data": [], "expense_data": []}
        
        # Build card_id -> academic_year_id mapping for yearly aggregation
        card_to_year = {card.id: card.academic_year_id for card in cards}
        
        # Aggregate by period
        period_data = defaultdict(lambda: {"income": Decimal("0"), "expense": Decimal("0")})
        
        for transaction in transactions:
            trans_date = transaction.transaction_date
            amount = transaction.amount
            
            if period_type == "weekly":
                # Get ISO week number
                year, week, _ = trans_date.isocalendar()
                # Format: "2024-W01"
                period_key = f"{year}-W{week:02d}"
                # For display: "الأسبوع 1 - كانون الثاني 2024"
                month_name = trans_date.strftime("%B %Y")
                period_label = f"الأسبوع {week}"
                
            elif period_type == "monthly":
                # Format: "2024-01"
                period_key = trans_date.strftime("%Y-%m")
                # For display: Arabic month name and year
                import calendar
                month_names_ar = {
                    1: "كانون الثاني", 2: "شباط", 3: "آذار", 4: "نيسان",
                    5: "أيار", 6: "حزيران", 7: "تموز", 8: "آب",
                    9: "أيلول", 10: "تشرين الأول", 11: "تشرين الثاني", 12: "كانون الأول"
                }
                period_label = f"{month_names_ar[trans_date.month]} {trans_date.year}"
                
            else:  # yearly
                # Get the academic year for this transaction's card
                trans_year_id = card_to_year.get(transaction.card_id)
                if not trans_year_id:
                    continue  # Skip if card not found (shouldn't happen)
                
                period_key = str(trans_year_id)
                period_label = year_names.get(trans_year_id, f"Year {trans_year_id}")
            
            # Aggregate amounts
            if transaction.transaction_type == "income":
                period_data[period_key]["income"] += amount
                period_data[period_key]["label"] = period_label
            elif transaction.transaction_type == "expense":
                period_data[period_key]["expense"] += amount
                period_data[period_key]["label"] = period_label
        
        # Sort periods chronologically
        sorted_periods = sorted(period_data.keys())
        
        # Build response
        periods = []
        income_data = []
        expense_data = []
        
        for period_key in sorted_periods:
            data = period_data[period_key]
            periods.append(data.get("label", period_key))
            income_data.append(float(data["income"]))
            expense_data.append(float(data["expense"]))
        
        return {
            "periods": periods,
            "income_data": income_data,
            "expense_data": expense_data
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch transaction analytics: {str(e)}"
        )