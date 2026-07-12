/* ============================================
   CATEGORIES MODULE
   Manage product categories
   ============================================ */

const CategoriesModule = {
  async render(container) {
    const categories = await LoyDB.getAll('categories');

    container.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1 class="page-title">Categories</h1>
          <p class="page-subtitle">Manage product categories</p>
        </div>
        <div class="page-header-right">
          ${Auth.canCreate() ? '<button class="btn btn-primary" onclick="CategoriesModule.showForm()">➕ Add Category</button>' : ''}
        </div>
      </div>

      <div class="card animate-fadeInUp">
        <div class="card-body p-0">
          <div id="categories-table"></div>
        </div>
      </div>
    `;

    this.renderTable(categories);
  },

  renderTable(categories) {
    const tableContainer = document.getElementById('categories-table');
    if (!tableContainer) return;

    tableContainer.innerHTML = DataTable.render({
      id: 'cat-table',
      columns: [
        { key: 'icon', label: 'Icon', render: (row) => '<span style="font-size: 24px">' + row.icon + '</span>' },
        { key: 'name', label: 'Category Name', render: (row) => '<span class="font-semibold">' + Utils.escapeHtml(row.name) + '</span>' },
        { key: 'desc', label: 'Description', render: (row) => Utils.escapeHtml(row.desc) || '-' },
      ],
      data: categories,
      searchable: true,
      searchKeys: ['name', 'desc'],
      pagination: true,
      perPage: 15,
      emptyMessage: 'No categories found',
      emptyIcon: '🏷️',
      actions: [
        ...(Auth.canUpdate() ? [{ icon: '✏️', title: 'Edit', class: 'edit', onclick: 'CategoriesModule.showForm' }] : []),
        ...(Auth.canDelete() ? [{ icon: '🗑️', title: 'Delete', class: 'delete', onclick: 'CategoriesModule.deleteCategory' }] : []),
      ]
    });
  },

  async showForm(id = null) {
    let category = null;
    if (id) {
      category = await LoyDB.get('categories', id);
    }

    const title = category ? 'Edit Category' : 'Add Category';
    const catName = category ? Utils.escapeHtml(category.name) : '';
    const catIcon = category ? Utils.escapeHtml(category.icon) : '📦';
    const catDesc = category ? Utils.escapeHtml(category.desc) : '';

    const body = '<form id="category-form" onsubmit="CategoriesModule.saveCategory(event, ' + (id || 'null') + ')">'
      + '<div class="form-group"><label class="form-label">Category Name <span class="required">*</span></label>'
      + '<input type="text" class="form-control" name="name" required value="' + catName + '"></div>'
      + '<div class="form-group"><label class="form-label">Icon (Emoji)</label>'
      + '<input type="text" class="form-control" name="icon" value="' + catIcon + '"></div>'
      + '<div class="form-group"><label class="form-label">Description</label>'
      + '<textarea class="form-control" name="desc" rows="3">' + catDesc + '</textarea></div>'
      + '</form>';

    const footer = '<button class="btn btn-outline" onclick="Modal.close()">Cancel</button>'
      + '<button type="submit" form="category-form" class="btn btn-primary">Save</button>';

    Modal.show(title, body, 'sm', footer);
  },

  async saveCategory(e, id) {
    e.preventDefault();
    const form = e.target;
    const data = Object.fromEntries(new FormData(form));

    try {
      if (id) {
        const existing = await LoyDB.get('categories', id);
        Object.assign(existing, data);
        await LoyDB.put('categories', existing);
        Toast.show('Success', 'Category updated', 'success');
      } else {
        await LoyDB.add('categories', data);
        Toast.show('Success', 'Category created', 'success');
      }
      Modal.close();
      App.navigate('categories');
    } catch (err) {
      Toast.show('Error', err.message, 'error');
    }
  },

  async deleteCategory(id) {
    const confirmed = await Modal.confirm('Delete Category', 'Are you sure you want to delete this category?', 'danger');
    if (confirmed) {
      await LoyDB.delete('categories', id);
      Toast.show('Deleted', 'Category deleted successfully', 'success');
      App.navigate('categories');
    }
  }
};
