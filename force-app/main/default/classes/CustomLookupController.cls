/***************************************************************************************************
* Description: create dynamic query based on parameter and fecth records
*****************************************************************************************************/
public with sharing class CustomLookupController {
    private static String queryString1 = 'SELECT Id,Name';
    
    @AuraEnabled(cacheable=true)
    public static List<sObject> fetchLookupData(Searchable searcher) {    
        List<sObject> resultList = new List<sObject> ();

        List<Id> recId = searcher.selectedRecId;

        //create query
        String sWildCardText = '%' + searcher.searchTerm + '%';

        String queryString2 = ' From ' + searcher.objectName + ' Where (' + checkType(searcher.objectName, searcher.firstField ) + checkType(searcher.objectName, searcher.secondField);

        String searchquery = queryString1 + queryString2 + 'Name Like:sWildCardText) AND ID NOT IN: recId order by createdDate DESC LIMIT ' + searcher.lim;

        System.debug(searchquery);
        
        for (sObject obj: database.query(searchquery)) {
            resultList.add(obj);
        }
        
        return resultList;
    }

    /**
     * @description: to check field data type
     * @param: objectName and fieldName api
     * @ return: true if field type is string
     */
    public static Boolean fieldType(String objectName, String fieldName){
        try{
        Schema.SOAPType f = Schema.getGlobalDescribe() 
            .get(objectName)
            .getDescribe()
            .fields
            .getMap()
            .get(fieldName)
            .getDescribe()
            .getSOAPType();
        return (String.valueOf(f) == 'STRING');
        }
        catch(Exception ex){
            return false;
        }
        
    }

    /**
     * @description: concat like operator to query if the feild type is string
     * @param: objectName and fieldName api
     * @ return: string
     */
    public static String checkType(String objectName, String fieldName){
        if(fieldName == null || fieldName == ''){
            return '';
        }

        String query = '';

        if(fieldType(objectName, fieldName)){
            queryString1 += ',' + fieldName;
            query += fieldName + ' Like:sWildCardText OR ';
        }
        else {
            queryString1 += ',' + fieldName;
        }
        return query;
    }

    public class Searchable {

		@AuraEnabled
		public String searchTerm {get;set;}
		@AuraEnabled
		public String objectName {get;set;}
        @AuraEnabled
		public String firstField {get;set;}
		@AuraEnabled
		public String secondField {get;set;}
        @AuraEnabled
		public Integer lim {get;set;}
		@AuraEnabled
		public List<Id> selectedRecId {get;set;}
	}

    @AuraEnabled(cacheable=true)
    public static List<sObject> getRecentRecord(Searchable searcher) {
        String query = 'SELECT Id,Name, ' +searcher.firstField+ ',' +searcher.secondField + ' FROM '+searcher.objectName+' order by createdDate DESC LIMIT 15';
        System.debug(query);
        return Database.query(query);
    }
}