import { LightningElement, track, api, wire } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import fetchLookupData from '@salesforce/apex/CustomLookupController.fetchLookupData';
import getRecentRecord from '@salesforce/apex/CustomLookupController.getRecentRecord';

const SEARCH_DELAY = 300; // Wait 300 ms after user stops typing then, perform search

export default class CustomLookup extends NavigationMixin(LightningElement) {
    @api label;                                     //label of customLookup
    @api selectedRecords = [];                      //array of selected record item
    @api placeholder = 'search here';
    @api isMultiEntry = false;                      //boolean to make lookup multiselectable or single
    @api objectName;                                // object api name
    @api firstField;                                // first field api name
    @api secondField;                               // second field api name                               
    @api iconName = 'standard:default';
    @api limit = 20;
    @api createRecord = false;
    @api createRecordLabel = 'New Record';                                // limit of search results
    searchTerm = '';                                //input search key
    searchResults = [];                             // search results
    results;
    hasFocus = false;
    cleanSearchTerm;                                //search key after removing trailing whitespace
    blurTimeout;
    searchThrottlingTimeout;

    recentRecord = [];
    recentData;
    isInputEmpty;
    showModal = false;
    cancelBlur = false;
    isResultClick = false;

    dataSearch() {
        const searcher = this.getSearcher();
        fetchLookupData({ searcher })
            .then(data => {
                this.results = data;
                //Format searchResult data
                this.searchResults = this.formatData(data)
                this.isInputEmpty = false;
            })
            .catch(error => {
                this.notifyUser('Lookup Error', 'An error occured while searching record.', 'error');
                console.error('Lookup error', JSON.stringify(error));
            });
    }

    connectedCallback(){
        const searcher = this.getSearcher();
        getRecentRecord({searcher})
        .then(data => {
            this.recentData = data;
            this.recentRecord = this.formatData(data);
            this.updateRecentRecord();
            this.isInputEmpty = true;
        })
        .catch(error => {
            this.notifyUser('Lookup Error', 'An error occured while fething recent record.', 'error');
            console.error('Lookup error', JSON.stringify(error));
        })
    }

    formatData(data) {
        let format = data.map(obj => {
            let Id = obj.Id
            let Name = obj.Name
            let field = ''
            if (this.firstField in obj && this.secondField in obj) {
                field = obj[this.firstField] + ' • ' + obj[this.secondField]
            }
            else if (this.firstField in obj) {
                field = obj[this.firstField]
            }
            else if (this.secondField in obj) {
                field = obj[this.secondField]
            }
            return { Id, Name, field }
        })

        return format;
    }

    getSearcher() {
        let selectedRecId = [];
        for (let i = 0; i < this.selectedRecords.length; i++) {
            selectedRecId.push(this.selectedRecords[i].Id);
        }
        return {
            searchTerm: this.cleanSearchTerm,
            objectName: this.objectName,
            firstField: this.firstField,
            secondField: this.secondField,
            lim: this.limit,
            selectedRecId: selectedRecId
        }
    }

    notifyUser(title, message, variant) {
        const toastEvent = new ShowToastEvent({ title, message, variant });
        this.dispatchEvent(toastEvent);
    }

    isSelectionAllowed() {
        //if it is multiple selection return true
        if (this.isMultiEntry) {
            return true;
        }
        return !this.hasSelection();  // if selectedrecord > 0 ==> false
    }

    hasResults() {
        return this.searchResults.length > 0;
    }

    //check if record is selected and length greater than 0...
    hasSelection() {
        return this.selectedRecords.length > 0;
    }

    handleInput(event) {
        //if it single selection and we already selected one record than it will return
        if (!this.isSelectionAllowed()) {
            return;
        }
        this.searchTerm = event.target.value;
        // Compare clean new search term with current one and abort if identical
        const newCleanSearchTerm = this.searchTerm.trim().replace(/\*/g, '').toLowerCase();
        if (this.cleanSearchTerm === newCleanSearchTerm) {
            return;
        }

        // Save clean search term
        this.cleanSearchTerm = newCleanSearchTerm;
        // Apply search throttling (prevents search if user is still typing)
        if (this.searchThrottlingTimeout) {
            clearTimeout(this.searchThrottlingTimeout);
        }
        this.searchThrottlingTimeout = setTimeout(() => {
            if(this.cleanSearchTerm.length < 1){
                this.updateRecentRecord();
                this.isInputEmpty = true
                return;
            }
            else{
                this.dataSearch()
            }
        }, SEARCH_DELAY);
    }

    handleResultClick(event) {
        this.isResultClick = true;
        const recordId = event.currentTarget.dataset.recid;
        var objId = event.target.getAttribute('data-recid');
        // Save selectedRecords
        let selectedItem;
        if(this.isInputEmpty){
            selectedItem = this.recentData.find(result => result.Id === objId);
        }
        else{
            selectedItem = this.results.find(result => result.Id === objId);
        }

        if (!selectedItem) {
            return;
        }
        this.recentRecord = this.recentRecord.filter((item) => item.Id !== selectedItem.Id);
        this.updateRecentRecord();

        const newSelection = [...this.selectedRecords];
        newSelection.push(selectedItem);
        this.selectedRecords = newSelection;
        // Reset search
        this.searchTerm = '';
        this.isInputEmpty = true;
        this.hasFocus = false;
        // Notify parent components that selectedRecords has changed
        this.lookupUpdatehandler(this.selectedRecords);
    }

    updateRecentRecord(){
        let fiveRecord = [];
        for(let i = 0; i<5 && i<this.recentRecord.length; ++i){
            fiveRecord[i] = this.recentRecord[i];
        }
        this.searchResults = fiveRecord;
    }

    handleRemoveSelectedItem(event) {
        const recordId = event.currentTarget.name;
        this.selectedRecords = this.selectedRecords.filter(item => item.Id !== recordId);
        // Notify parent components that selectedRecords has changed
        this.lookupUpdatehandler(this.selectedRecords);
    }

    //remove single selected record if isMultiEntry false
    handleClearSelection() {
        this.selectedRecords = [];
        // Notify parent components that selectedRecords has changed
        this.lookupUpdatehandler(this.selectedRecords);
    }

    // send selected lookup record to parent component using custom event
    lookupUpdatehandler(value) {
        const selectedEvent = new CustomEvent('userselected', {
            detail: value
        });
        this.dispatchEvent(selectedEvent);
    }

    handleFocus() {
        console.log('handleFocus');
        // Prevent action if selectedRecords is not allowed
        //return on single selection
        if (!this.isSelectionAllowed()) {
            return;
        }
        this.hasFocus = true;
    }

    handleBlur() {
        console.log('handleBlur.v4');
        // Prevent action if selectedRecords is not allowed
        //return on single selection
        if (!this.isSelectionAllowed() || this.cancelBlur) {
            return;
        }
        this.hasFocus = false;
    }

    handleNewRecordClick(){
        this.showModal = true;
    }

    handleMouseDown(event) {
        const mainButton = 0;
        if (event.button === mainButton) {
            this.cancelBlur = true;
        }
    }

    handleMouseUp() {
        this.cancelBlur = false;
        // Re-focus to text input for the next blur event
        if (this.blurTimeout) {
            window.clearTimeout(this.blurTimeout);
        }
        this.blurTimeout = window.setTimeout(() =>{
            if(!this.isResultClick){
                this.template.querySelector('input').focus();
            }
            this.isResultClick = false;
        },
            50
        );
    }

    successHandler(event){
        let newRecord = {}
        newRecord.Id = event.detail.id;
        newRecord.Name = event.detail.fields.Name.value;
        newRecord[this.firstField] = event.detail.fields[this.firstField].value;
        newRecord[this.secondField] = event.detail.fields[this.secondField].value;
        this.selectedRecords.push(newRecord);
        this.showModal=false;
        this.lookupUpdatehandler(this.selectedRecords);
    }

    cancelHandler(){
        this.showModal=false;
    }

    get getContainerClass() {

        let css = 'slds-combobox_container ';
        if (this.hasFocus && this.hasResults()) {
            css += 'slds-has-input-focus ';
        }
        return css;
    }

    get getDropdownClass() {

        let css = 'slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click ';
        if(this.hasFocus){
            css += 'slds-is-open';
        }
        return css;
    }

    get getInputClass() {
        let css = 'slds-input slds-combobox__input has-custom-height ';
        if (!this.isMultiEntry) {
            css += 'slds-combobox__input-value '
                + (this.hasSelection() ? 'has-custom-border' : '');
        }
        return css;
    }

    get getComboboxClass() {
        let css = 'slds-combobox__form-element slds-input-has-icon ';
        if (this.isMultiEntry) {
            css += 'slds-input-has-icon_right';
        } else {
            css += (this.hasSelection() ? 'slds-input-has-icon_left-right' : 'slds-input-has-icon_right');
        }
        return css;
    }

    get getSearchIconClass() {
        let css = 'slds-input__icon slds-input__icon_right ';
        if (!this.isMultiEntry) {
            css += (this.hasSelection() ? 'slds-hide' : '');
        }
        return css;
    }

    get getClearSelectionButtonClass() {
        return (
            'slds-button slds-button_icon slds-input__icon slds-input__icon_right ' +
            (this.hasSelection() ? '' : 'slds-hide')
        );
    }

    get getSelectIconName() {
        return this.hasSelection() ? this.iconName : 'standard:default';
    }

    get getSelectIconClass() {
        return 'slds-combobox__input-entity-icon ' + (this.hasSelection() ? '' : 'slds-hide');
    }

    get getInputValue() {
        if (this.isMultiEntry) {
            return this.searchTerm;
        }
        if (this.hasSelection()) {
            return this.selectedRecords[0].Name;
        }
        return this.searchTerm
    }

    get isInputReadonly() {
        if (this.isMultiEntry) {
            return false;
        }
        return this.hasSelection();
    }

    get isExpanded() {
        return this.hasResults();
    }
}